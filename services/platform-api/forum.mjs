import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { json, readJson } from "../shared/http.mjs";
import { query, transaction } from "../shared/postgres.mjs";

const LOCAL_USER_ID = process.env.LOCAL_PROFILE_ID || "00000000-0000-0000-0000-000000000001";
const ANONYMOUS_USER_ID = "00000000-0000-0000-0000-000000000000";
const REACTIONS = new Set(["like", "dislike", "helpful", "thanks", "insightful", "field_tested"]);
const THREAD_KINDS = new Set(["discussion", "question", "new_product", "promotion", "deal", "listing", "showcase", "troubleshooting"]);
const THREAD_KIND_ALIASES = { build: "showcase", product: "new_product", sale: "listing" };
const REPORT_REASONS = new Set(["spam", "harassment", "scam", "unsafe_electrical_advice", "misinformation", "undisclosed_promotion", "wrong_category", "other"]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const rateBuckets = new Map();

class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function migrationSource(filename) {
  const candidates = [
    new URL(`./migrations/${filename}`, import.meta.url),
    new URL(`../../infra/postgres/${filename}`, import.meta.url),
  ];
  const found = candidates.find(candidate => existsSync(fileURLToPath(candidate)));
  if (!found) throw new Error("community_migration_not_found");
  return readFileSync(found, "utf8");
}

export async function applyCommunityMigration() {
  if (!process.env.DATABASE_URL) return { applied: false, reason: "database_not_configured" };
  await query("create table if not exists schema_migrations(version text primary key, applied_at timestamptz not null default now())");
  const existing = await query("select 1 from schema_migrations where version='002-community'");
  if (!existing.rowCount) await query(migrationSource("002-community.sql"));
  const publicNumbers = await query("select 1 from schema_migrations where version='003-community-public-numbers'");
  if (!publicNumbers.rowCount) {
    await query(migrationSource("003-community-public-numbers.sql"));
    await query("insert into schema_migrations(version) values('003-community-public-numbers')");
  }
  await query(
    `insert into forum_categories(slug,group_name,name,description,icon,color,sort_order,posting_policy)
     values
       ('vendor-reviews','News & promotions','Vendor Reviews','Documented buying experiences, support outcomes and retailer feedback.','review','#f29d49',35,'member'),
       ('charge-controllers','Solar systems','Charge Controllers','MPPT and PWM controller sizing, configuration, limits and troubleshooting.','controller','#73a7ff',65,'member'),
       ('generators','Solar systems','Generators','Fuel backup generators, auto-start, transfer equipment and integration.','generator','#ed655d',75,'member'),
       ('tools','Solar systems','Tools & Test Equipment','Meters, scopes, crimpers, testers and field equipment recommendations.','tools','#53e38e',85,'member'),
       ('software','Solar systems','Software','Monitoring, automation, firmware, communications and open-source projects.','software','#73a7ff',95,'member'),
       ('solar-for-sale','Marketplace','Solar Panels for Sale','Member listings for personally owned solar modules.','market','#f3c647',140,'trusted_member'),
       ('batteries-for-sale','Marketplace','Batteries for Sale','Member listings for batteries, cells, racks and related storage equipment.','market','#53e38e',141,'trusted_member'),
       ('inverters-for-sale','Marketplace','Inverters for Sale','Member listings for inverters, all-in-one units and power electronics.','market','#f29d49',142,'trusted_member'),
       ('humor','Off-topic','Humor','Solar jokes, memes and lighthearted workshop moments.','chat','#f3c647',180,'member'),
       ('random-no-politics','Off-topic','Random — No Politics','General conversation with politics and political arguments excluded.','chat','#87938d',181,'member'),
       ('ranting','Off-topic','Ranting','A place to vent about projects and products while keeping it civil.','chat','#ed655d',182,'member')
     on conflict(slug) do update set group_name=excluded.group_name,name=excluded.name,description=excluded.description,is_active=true`,
  );
  await query(
    `update forum_categories set is_active=(slug=any($1::text[]))`,
    [[
      "forum-help", "diy-general", "showcase", "online-deals", "new-products", "vendor-reviews",
      "panels-arrays", "batteries-storage", "inverters-chargers", "charge-controllers", "roof-mounting",
      "generators", "tools", "software", "solar-for-sale", "batteries-for-sale", "inverters-for-sale",
      "for-sale", "humor", "random-no-politics", "ranting",
    ]],
  );
  return existing.rowCount && publicNumbers.rowCount ? { applied: false, reason: "already_applied" } : { applied: true };
}

export function validatePlainText(value, { field, min = 1, max }) {
  if (typeof value !== "string") throw new ApiError(422, "validation_error", `${field} must be text`, { field });
  const text = value.replace(/\r\n?/g, "\n").normalize("NFKC").trim();
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)) {
    throw new ApiError(422, "validation_error", `${field} contains unsupported control characters`, { field });
  }
  if (text.length < min || text.length > max) {
    throw new ApiError(422, "validation_error", `${field} must be between ${min} and ${max} characters`, { field, min, max });
  }
  return text;
}

function validateUuid(value, field) {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    throw new ApiError(422, "validation_error", `${field} must be a UUID`, { field });
  }
  return value;
}

function rejectClientIdentity(body) {
  if (Object.hasOwn(body, "authorId") || Object.hasOwn(body, "author_id") || Object.hasOwn(body, "userId") || Object.hasOwn(body, "user_id")) {
    throw new ApiError(422, "server_derived_identity", "Author identity is derived by the server");
  }
}

async function actor(required = true) {
  if ((process.env.AUTH_MODE || "local") !== "local") {
    if (required) throw new ApiError(401, "authentication_required", "Sign in to perform this action");
    return null;
  }
  const result = await query("select id,display_name,role from users where id=$1", [LOCAL_USER_ID]);
  if (!result.rowCount) throw new ApiError(503, "local_profile_missing", "The configured local profile does not exist");
  return result.rows[0];
}

function roleLevel(role) {
  return ({ member: 1, trusted_member: 2, moderator: 3, editor: 3, admin: 4 })[role] || 0;
}

function requireRole(currentActor, minimum) {
  if (roleLevel(currentActor.role) < roleLevel(minimum)) {
    throw new ApiError(403, "insufficient_role", `This action requires ${minimum} access`);
  }
}

export function consumeRateLimit(actorId, action, maximum, windowMs, now = Date.now()) {
  const key = `${actorId}:${action}`;
  const cutoff = now - windowMs;
  const recent = (rateBuckets.get(key) || []).filter(timestamp => timestamp > cutoff);
  if (recent.length >= maximum) {
    const retryAfterMs = Math.max(1, recent[0] + windowMs - now);
    throw new ApiError(429, "rate_limited", "Please wait before trying that action again", { retryAfterSeconds: Math.ceil(retryAfterMs / 1000) });
  }
  recent.push(now);
  rateBuckets.set(key, recent);
  if (rateBuckets.size > 5000) rateBuckets.delete(rateBuckets.keys().next().value);
}

export function resetRateLimitsForTests() {
  rateBuckets.clear();
}

function initials(name = "") {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join("") || "?";
}

function mapAuthor(row, prefix = "author") {
  const id = row[`${prefix}_id`];
  const displayName = row[`${prefix}_name`] || "Former member";
  return { id, displayName, role: row[`${prefix}_role`] || "member", initials: initials(displayName) };
}

function mapThread(row) {
  return {
    id: row.id,
    publicNumber: Number(row.public_number),
    title: row.title,
    categorySlug: row.category_slug,
    categoryName: row.category_name,
    categoryColor: row.category_color,
    kind: row.kind,
    author: mapAuthor(row),
    replyCount: Number(row.reply_count || 0),
    reactionCount: Number(row.reaction_count || 0),
    viewCount: Number(row.view_count || 0),
    bookmarkCount: Number(row.bookmark_count || 0),
    followerCount: Number(row.follower_count || 0),
    acceptedPostId: row.accepted_post_id,
    firstPostId: row.first_post_id,
    lastPostId: row.last_post_id,
    locked: row.locked,
    pinned: row.pinned,
    featured: row.featured,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastActivityAt: row.last_activity_at,
    viewerBookmarked: Boolean(row.viewer_bookmarked),
    viewerFollowing: Boolean(row.viewer_following),
    tags: [],
  };
}

function encodeCursor(offset) {
  return Buffer.from(String(offset), "utf8").toString("base64url");
}

function decodeCursor(value) {
  if (!value) return 0;
  try {
    const offset = Number(Buffer.from(value, "base64url").toString("utf8"));
    return Number.isInteger(offset) && offset >= 0 ? offset : 0;
  } catch {
    return 0;
  }
}

async function readBody(request) {
  try {
    return await readJson(request);
  } catch (error) {
    if (error.code === "PAYLOAD_TOO_LARGE") throw new ApiError(413, "payload_too_large", "Request body is too large");
    throw new ApiError(400, "invalid_json", "Request body must be valid JSON");
  }
}

async function listForums(response, requestId) {
  const [categories, stats] = await Promise.all([
    query(
      `select c.slug,c.group_name,c.name,c.description,c.icon,c.color,c.sort_order,c.posting_policy,
         count(distinct t.id) filter(where t.status='visible') as thread_count,
         count(distinct p.id) filter(where p.status='visible' and t.status='visible') as post_count,
         max(t.last_activity_at) filter(where t.status='visible') as last_activity_at,
         lt.id as latest_thread_id,lt.title as latest_thread_title,lt.last_activity_at as latest_thread_at,
         lu.display_name as latest_author_name
       from forum_categories c
       left join forum_threads t on t.category_slug=c.slug
       left join forum_posts p on p.thread_id=t.id
       left join lateral (
         select x.id,x.title,x.last_activity_at,x.author_id
         from forum_threads x where x.category_slug=c.slug and x.status='visible'
         order by x.last_activity_at desc limit 1
       ) lt on true
       left join users lu on lu.id=lt.author_id
       where c.is_active and c.visibility='public'
       group by c.slug,lt.id,lt.title,lt.last_activity_at,lu.display_name order by c.sort_order,c.name`,
    ),
    query(
      `select
         (select count(*) from users) as members,
         (select count(*) from forum_threads where status='visible') as threads,
         (select count(*) from forum_posts where status='visible') as posts,
         (select count(*) from forum_threads where status='visible' and accepted_post_id is not null) as solved`,
    ),
  ]);
  const data = {
    categories: categories.rows.map(row => ({
      slug: row.slug,
      groupName: row.group_name,
      name: row.name,
      description: row.description,
      icon: row.icon,
      color: row.color,
      postingPolicy: row.posting_policy,
      threadCount: Number(row.thread_count || 0),
      postCount: Number(row.post_count || 0),
      lastActivityAt: row.last_activity_at,
      latest: row.latest_thread_id ? {
        threadId: row.latest_thread_id,
        title: row.latest_thread_title,
        authorName: row.latest_author_name || "Former member",
        at: row.latest_thread_at,
      } : null,
    })),
    stats: {
      members: Number(stats.rows[0]?.members || 0),
      threads: Number(stats.rows[0]?.threads || 0),
      posts: Number(stats.rows[0]?.posts || 0),
      solved: Number(stats.rows[0]?.solved || 0),
    },
  };
  return json(response, 200, { data }, requestId) || true;
}

async function listThreads(url, response, requestId) {
  const currentActor = await actor(false);
  const category = url.searchParams.get("category") || "";
  const search = (url.searchParams.get("q") || "").trim().slice(0, 200);
  const sort = url.searchParams.get("sort") || "latest";
  const period = url.searchParams.get("period") || "all";
  const allowedSorts = new Set(["latest", "top", "unanswered", "following", "bookmarked"]);
  const periodMs = { "1d": 86400000, "7d": 604800000, "30d": 2592000000, "6m": 15778800000, "1y": 31557600000, all: null };
  if (!allowedSorts.has(sort)) throw new ApiError(422, "validation_error", "Unsupported thread sort");
  if (!Object.hasOwn(periodMs, period)) throw new ApiError(422, "validation_error", "Unsupported activity period");
  if (["following", "bookmarked"].includes(sort) && !currentActor) throw new ApiError(401, "authentication_required", "Sign in to view personal threads");
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") || 20) || 20));
  const offset = decodeCursor(url.searchParams.get("cursor"));
  const order = sort === "top"
    ? "(t.reaction_count*3+t.reply_count*2+t.view_count/25) desc,t.last_activity_at desc,t.id desc"
    : "t.pinned desc,t.last_activity_at desc,t.id desc";
  const result = await query(
    `select t.*,c.name as category_name,c.color as category_color,
       u.id as author_id,u.display_name as author_name,u.role as author_role,
       exists(select 1 from forum_thread_bookmarks b where b.thread_id=t.id and b.user_id=$5::uuid) as viewer_bookmarked,
       exists(select 1 from forum_thread_follows f where f.thread_id=t.id and f.user_id=$5::uuid) as viewer_following
     from forum_threads t
     join forum_categories c on c.slug=t.category_slug
     left join users u on u.id=t.author_id
     where t.status='visible'
       and ($1='' or t.category_slug=$1)
       and ($2='' or to_tsvector('english',coalesce(t.title,'') || ' ' || coalesce(t.body,'')) @@ websearch_to_tsquery('english',$2))
       and ($3<>'unanswered' or (t.kind in ('question','troubleshooting') and t.accepted_post_id is null))
       and ($3<>'following' or exists(select 1 from forum_thread_follows ff where ff.thread_id=t.id and ff.user_id=$5::uuid))
       and ($3<>'bookmarked' or exists(select 1 from forum_thread_bookmarks bb where bb.thread_id=t.id and bb.user_id=$5::uuid))
       and ($7::timestamptz is null or t.last_activity_at >= $7::timestamptz)
     order by ${order}
     limit $4 offset $6`,
    [category, search, sort, limit + 1, currentActor?.id || ANONYMOUS_USER_ID, offset, periodMs[period] == null ? null : new Date(Date.now() - periodMs[period])],
  );
  const hasMore = result.rows.length > limit;
  const threads = result.rows.slice(0, limit).map(mapThread);
  return json(response, 200, { data: { threads, nextCursor: hasMore ? encodeCursor(offset + limit) : null } }, requestId) || true;
}

async function reactionDetails(postIds, currentActor) {
  if (!postIds.length) return new Map();
  const rows = await query(
    `select post_id,reaction,count(*)::int as count,
       bool_or(user_id=$2::uuid) as selected_by_viewer
     from reactions where post_id=any($1::uuid[])
     group by post_id,reaction`,
    [postIds, currentActor?.id || ANONYMOUS_USER_ID],
  );
  const details = new Map(postIds.map(id => [id, { summary: {}, viewerReaction: null }]));
  for (const row of rows.rows) {
    const item = details.get(row.post_id);
    item.summary[row.reaction] = Number(row.count);
    if (row.selected_by_viewer) item.viewerReaction = row.reaction;
  }
  return details;
}

function mapPost(row, details, acceptedPostId) {
  const reaction = details.get(row.id) || { summary: {}, viewerReaction: null };
  return {
    id: row.id,
    threadId: row.thread_id,
    parentId: row.parent_id,
    body: row.status === "deleted" ? "This post was removed." : row.body,
    isOriginal: row.is_original,
    position: row.position,
    status: row.status,
    author: mapAuthor(row),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    editedAt: row.edited_at,
    reactionCount: Number(row.reaction_count || 0),
    reactionSummary: reaction.summary,
    viewerReaction: reaction.viewerReaction,
    isAccepted: row.id === acceptedPostId,
  };
}

async function fetchThread(threadId, currentActor, { countView = false } = {}) {
  if (countView) await query("update forum_threads set view_count=view_count+1 where id=$1 and status='visible'", [threadId]);
  const result = await query(
    `select t.*,c.name as category_name,c.color as category_color,
       u.id as author_id,u.display_name as author_name,u.role as author_role,
       exists(select 1 from forum_thread_bookmarks b where b.thread_id=t.id and b.user_id=$2::uuid) as viewer_bookmarked,
       exists(select 1 from forum_thread_follows f where f.thread_id=t.id and f.user_id=$2::uuid) as viewer_following
     from forum_threads t
     join forum_categories c on c.slug=t.category_slug
     left join users u on u.id=t.author_id
     where t.id=$1 and t.status='visible'`,
    [threadId, currentActor?.id || ANONYMOUS_USER_ID],
  );
  if (!result.rowCount) throw new ApiError(404, "thread_not_found", "Thread not found");
  const thread = mapThread(result.rows[0]);
  const postResult = await query(
    `select p.*,u.id as author_id,u.display_name as author_name,u.role as author_role
     from forum_posts p left join users u on u.id=p.author_id
     where p.thread_id=$1 and p.status<>'hidden'
     order by p.position,p.created_at,p.id`,
    [threadId],
  );
  const details = await reactionDetails(postResult.rows.map(row => row.id), currentActor);
  const mapped = postResult.rows.map(row => mapPost(row, details, thread.acceptedPostId));
  const originalPost = mapped.find(post => post.isOriginal) || null;
  return {
    thread,
    originalPost,
    posts: mapped.filter(post => !post.isOriginal),
    viewer: {
      bookmarked: thread.viewerBookmarked,
      following: thread.viewerFollowing,
      canReply: Boolean(currentActor) && !thread.locked,
      canModerate: Boolean(currentActor) && roleLevel(currentActor.role) >= roleLevel("moderator"),
    },
  };
}

async function getThread(threadId, response, requestId) {
  validateUuid(threadId, "threadId");
  const currentActor = await actor(false);
  const data = await fetchThread(threadId, currentActor, { countView: true });
  return json(response, 200, { data }, requestId) || true;
}

async function getThreadByNumber(publicNumber, response, requestId) {
  const parsed = Number(publicNumber);
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw new ApiError(422, "validation_error", "Invalid thread number");
  const resolved = await query("select id from forum_threads where public_number=$1 and status='visible'", [parsed]);
  if (!resolved.rowCount) throw new ApiError(404, "thread_not_found", "Thread not found");
  const currentActor = await actor(false);
  const data = await fetchThread(resolved.rows[0].id, currentActor, { countView: true });
  return json(response, 200, { data }, requestId) || true;
}

async function createThread(request, response, requestId) {
  const currentActor = await actor();
  consumeRateLimit(currentActor.id, "create_thread", 8, 60 * 60 * 1000);
  const body = await readBody(request);
  rejectClientIdentity(body);
  const title = validatePlainText(body.title, { field: "title", min: 8, max: 180 });
  const content = validatePlainText(body.body, { field: "body", min: 20, max: 20000 });
  const categorySlug = typeof body.categorySlug === "string" ? body.categorySlug : body.category;
  if (typeof categorySlug !== "string" || !/^[a-z0-9-]{2,60}$/.test(categorySlug)) {
    throw new ApiError(422, "validation_error", "A valid categorySlug is required");
  }
  const requestedKind = body.kind || "discussion";
  const kind = THREAD_KIND_ALIASES[requestedKind] || requestedKind;
  if (!THREAD_KINDS.has(kind)) throw new ApiError(422, "validation_error", "Unsupported thread kind");
  const category = await query("select posting_policy from forum_categories where slug=$1 and is_active", [categorySlug]);
  if (!category.rowCount) throw new ApiError(422, "unknown_category", "Choose an active forum category");
  requireRole(currentActor, category.rows[0].posting_policy);
  if (categorySlug === "promotions" && !["promotion", "new_product"].includes(kind)) {
    throw new ApiError(422, "validation_error", "Promotion threads must use the promotion or new-product type");
  }
  const created = await transaction(async client => {
    const thread = await client.query(
      `insert into forum_threads(category_slug,author_id,title,body,kind)
       values($1,$2,$3,$4,$5) returning *`,
      [categorySlug, currentActor.id, title, content, kind],
    );
    const post = await client.query(
      `insert into forum_posts(thread_id,author_id,body,is_original,position)
       values($1,$2,$3,true,0) returning *`,
      [thread.rows[0].id, currentActor.id, content],
    );
    const updated = await client.query(
      `update forum_threads set first_post_id=$2,last_post_id=$2,updated_at=now()
       where id=$1 returning *`,
      [thread.rows[0].id, post.rows[0].id],
    );
    return { thread: updated.rows[0], post: post.rows[0] };
  });
  return json(response, 201, {
    data: {
      id: created.thread.id,
      publicNumber: Number(created.thread.public_number),
      title: created.thread.title,
      categorySlug: created.thread.category_slug,
      kind: created.thread.kind,
      originalPost: { id: created.post.id, body: created.post.body, isOriginal: true },
    },
  }, requestId) || true;
}

async function createPost(threadId, request, response, requestId) {
  validateUuid(threadId, "threadId");
  const currentActor = await actor();
  consumeRateLimit(currentActor.id, "create_post", 60, 60 * 60 * 1000);
  const body = await readBody(request);
  rejectClientIdentity(body);
  const content = validatePlainText(body.body, { field: "body", min: 2, max: 20000 });
  const parentId = body.parentId == null ? null : validateUuid(body.parentId, "parentId");
  const post = await transaction(async client => {
    const threadResult = await client.query(
      "select id,locked,status from forum_threads where id=$1 for update",
      [threadId],
    );
    if (!threadResult.rowCount || threadResult.rows[0].status !== "visible") throw new ApiError(404, "thread_not_found", "Thread not found");
    if (threadResult.rows[0].locked) throw new ApiError(409, "thread_locked", "This thread is locked");
    if (parentId) {
      const parent = await client.query("select 1 from forum_posts where id=$1 and thread_id=$2 and status='visible'", [parentId, threadId]);
      if (!parent.rowCount) throw new ApiError(422, "invalid_parent", "The parent post does not belong to this thread");
    }
    const positionResult = await client.query("select coalesce(max(position),0)+1 as position from forum_posts where thread_id=$1", [threadId]);
    const inserted = await client.query(
      `insert into forum_posts(thread_id,author_id,parent_id,body,position)
       values($1,$2,$3,$4,$5) returning *`,
      [threadId, currentActor.id, parentId, content, positionResult.rows[0].position],
    );
    await client.query(
      `update forum_threads set reply_count=reply_count+1,last_post_id=$2,last_activity_at=now(),updated_at=now()
       where id=$1`,
      [threadId, inserted.rows[0].id],
    );
    return inserted.rows[0];
  });
  return json(response, 201, {
    data: {
      id: post.id,
      threadId: post.thread_id,
      parentId: post.parent_id,
      body: post.body,
      position: post.position,
      isOriginal: false,
      author: { id: currentActor.id, displayName: currentActor.display_name, role: currentActor.role, initials: initials(currentActor.display_name) },
      createdAt: post.created_at,
      updatedAt: post.updated_at,
      reactionCount: 0,
      reactionSummary: {},
      viewerReaction: null,
      isAccepted: false,
    },
  }, requestId) || true;
}

async function setReaction(request, response, requestId) {
  const currentActor = await actor();
  consumeRateLimit(currentActor.id, "reaction", 120, 60 * 1000);
  const body = await readBody(request);
  rejectClientIdentity(body);
  let postId = body.postId;
  if (!postId && body.targetType === "thread" && body.targetId) {
    validateUuid(body.targetId, "targetId");
    const original = await query("select first_post_id from forum_threads where id=$1 and status='visible'", [body.targetId]);
    if (!original.rowCount || !original.rows[0].first_post_id) throw new ApiError(404, "thread_not_found", "Thread not found");
    postId = original.rows[0].first_post_id;
  }
  validateUuid(postId, "postId");
  const requestedReaction = body.reaction == null ? null : String(body.reaction);
  const reaction = requestedReaction === "field-tested" ? "field_tested" : requestedReaction;
  if (reaction && !REACTIONS.has(reaction)) throw new ApiError(422, "validation_error", "Unsupported reaction");
  const result = await transaction(async client => {
    const target = await client.query(
      `select p.id,p.thread_id from forum_posts p join forum_threads t on t.id=p.thread_id
       where p.id=$1 and p.status='visible' and t.status='visible'`,
      [postId],
    );
    if (!target.rowCount) throw new ApiError(404, "post_not_found", "Post not found");
    if (reaction) {
      await client.query(
        `insert into reactions(user_id,post_id,reaction) values($1,$2,$3)
         on conflict(user_id,post_id) do update set reaction=excluded.reaction,created_at=now()`,
        [currentActor.id, postId, reaction],
      );
    } else {
      await client.query("delete from reactions where user_id=$1 and post_id=$2", [currentActor.id, postId]);
    }
    const summary = await client.query(
      "select reaction,count(*)::int as count from reactions where post_id=$1 group by reaction order by reaction",
      [postId],
    );
    const count = summary.rows.reduce((sum, row) => sum + Number(row.count), 0);
    await client.query("update forum_posts set reaction_count=$2 where id=$1", [postId, count]);
    const threadCount = await client.query(
      `select count(*)::int as count from reactions r join forum_posts p on p.id=r.post_id where p.thread_id=$1`,
      [target.rows[0].thread_id],
    );
    await client.query("update forum_threads set reaction_count=$2,updated_at=now() where id=$1", [target.rows[0].thread_id, threadCount.rows[0].count]);
    return { count, summary: Object.fromEntries(summary.rows.map(row => [row.reaction, Number(row.count)])) };
  });
  return json(response, 200, { data: { postId, reaction, reactionCount: result.count, reactionSummary: result.summary } }, requestId) || true;
}

async function setThreadToggle(kind, threadId, request, response, requestId) {
  validateUuid(threadId, "threadId");
  const currentActor = await actor();
  consumeRateLimit(currentActor.id, kind, 120, 60 * 1000);
  const body = await readBody(request);
  rejectClientIdentity(body);
  const active = body.active !== false;
  const table = kind === "bookmark" ? "forum_thread_bookmarks" : "forum_thread_follows";
  const countColumn = kind === "bookmark" ? "bookmark_count" : "follower_count";
  const result = await transaction(async client => {
    const exists = await client.query("select 1 from forum_threads where id=$1 and status='visible'", [threadId]);
    if (!exists.rowCount) throw new ApiError(404, "thread_not_found", "Thread not found");
    if (active) await client.query(`insert into ${table}(user_id,thread_id) values($1,$2) on conflict do nothing`, [currentActor.id, threadId]);
    else await client.query(`delete from ${table} where user_id=$1 and thread_id=$2`, [currentActor.id, threadId]);
    const count = await client.query(`select count(*)::int as count from ${table} where thread_id=$1`, [threadId]);
    await client.query(`update forum_threads set ${countColumn}=$2 where id=$1`, [threadId, count.rows[0].count]);
    return Number(count.rows[0].count);
  });
  return json(response, 200, { data: { active, count: result } }, requestId) || true;
}

async function setAcceptedAnswer(threadId, request, response, requestId) {
  validateUuid(threadId, "threadId");
  const currentActor = await actor();
  const body = await readBody(request);
  rejectClientIdentity(body);
  const postId = body.postId == null ? null : validateUuid(body.postId, "postId");
  const accepted = await transaction(async client => {
    const threadResult = await client.query("select id,author_id,kind,status from forum_threads where id=$1 for update", [threadId]);
    if (!threadResult.rowCount || threadResult.rows[0].status !== "visible") throw new ApiError(404, "thread_not_found", "Thread not found");
    const thread = threadResult.rows[0];
    if (!["question", "troubleshooting"].includes(thread.kind)) throw new ApiError(409, "not_answerable", "Accepted answers are available only for question and troubleshooting threads");
    if (thread.author_id !== currentActor.id && roleLevel(currentActor.role) < roleLevel("moderator")) {
      throw new ApiError(403, "not_thread_owner", "Only the thread author or a moderator may choose the accepted answer");
    }
    if (postId) {
      const post = await client.query("select 1 from forum_posts where id=$1 and thread_id=$2 and not is_original and status='visible'", [postId, threadId]);
      if (!post.rowCount) throw new ApiError(422, "invalid_answer", "The accepted answer must be a visible reply in this thread");
    }
    await client.query("update forum_threads set accepted_post_id=$2,updated_at=now() where id=$1", [threadId, postId]);
    return postId;
  });
  return json(response, 200, { data: { threadId, acceptedPostId: accepted } }, requestId) || true;
}

async function createReport(request, response, requestId) {
  const currentActor = await actor();
  consumeRateLimit(currentActor.id, "report", 10, 24 * 60 * 60 * 1000);
  const body = await readBody(request);
  rejectClientIdentity(body);
  const targetType = String(body.targetType || "");
  if (!["thread", "post", "user"].includes(targetType)) throw new ApiError(422, "validation_error", "Unsupported report target");
  const targetId = validateUuid(body.targetId, "targetId");
  const reasonCode = String(body.reasonCode || "other");
  if (!REPORT_REASONS.has(reasonCode)) throw new ApiError(422, "validation_error", "Unsupported report reason");
  const details = validatePlainText(body.details || body.reason || "", { field: "details", min: 10, max: 2000 });
  const targetTable = targetType === "thread" ? "forum_threads" : targetType === "post" ? "forum_posts" : "users";
  const exists = await query(`select 1 from ${targetTable} where id=$1`, [targetId]);
  if (!exists.rowCount) throw new ApiError(404, "target_not_found", "Reported content was not found");
  const result = await query(
    `insert into moderation_reports(reporter_id,target_type,target_id,reason,reason_code,details)
     values($1,$2,$3,$4,$5,$6) returning *`,
    [currentActor.id, targetType, targetId, details, reasonCode, details],
  );
  return json(response, 201, {
    data: {
      id: result.rows[0].id,
      targetType,
      targetId,
      reasonCode,
      status: result.rows[0].status,
      createdAt: result.rows[0].created_at,
    },
  }, requestId) || true;
}

async function getMemberProfile(memberId, response, requestId) {
  validateUuid(memberId, "memberId");
  const [memberResult, statsResult, topicsResult, postsResult] = await Promise.all([
    query("select id,display_name,role,created_at from users where id=$1", [memberId]),
    query(
      `select
         (select count(*) from forum_threads where author_id=$1 and status='visible')::int as topics,
         (select count(*) from forum_posts where author_id=$1 and status='visible')::int as posts,
         (select count(*) from reactions r join forum_posts p on p.id=r.post_id where p.author_id=$1 and p.status='visible')::int as reactions_received`,
      [memberId],
    ),
    query(
      `select t.*,c.name as category_name,c.color as category_color,
         u.id as author_id,u.display_name as author_name,u.role as author_role,
         false as viewer_bookmarked,false as viewer_following
       from forum_threads t
       join forum_categories c on c.slug=t.category_slug
       left join users u on u.id=t.author_id
       where t.author_id=$1 and t.status='visible'
       order by t.last_activity_at desc limit 20`,
      [memberId],
    ),
    query(
      `select p.id,p.thread_id,p.body,p.created_at,t.title as thread_title,c.name as category_name
       from forum_posts p
       join forum_threads t on t.id=p.thread_id
       join forum_categories c on c.slug=t.category_slug
       where p.author_id=$1 and p.status='visible' and not p.is_original and t.status='visible'
       order by p.created_at desc limit 30`,
      [memberId],
    ),
  ]);
  if (!memberResult.rowCount) throw new ApiError(404, "member_not_found", "Member not found");
  const member = memberResult.rows[0];
  const stats = statsResult.rows[0] || {};
  return json(response, 200, {
    data: {
      member: {
        id: member.id,
        displayName: member.display_name,
        role: member.role,
        joinedAt: member.created_at,
      },
      stats: {
        topics: Number(stats.topics || 0),
        posts: Number(stats.posts || 0),
        reactionsReceived: Number(stats.reactions_received || 0),
      },
      topics: topicsResult.rows.map(mapThread),
      posts: postsResult.rows.map(row => ({
        id: row.id,
        threadId: row.thread_id,
        threadTitle: row.thread_title,
        categoryName: row.category_name,
        body: row.body,
        createdAt: row.created_at,
      })),
    },
  }, requestId) || true;
}

async function listReports(url, response, requestId) {
  const currentActor = await actor();
  requireRole(currentActor, "moderator");
  const status = url.searchParams.get("status") || "";
  if (status && !["open", "triaged", "resolved", "dismissed"].includes(status)) throw new ApiError(422, "validation_error", "Unsupported report status");
  const result = await query(
    `select r.*,reporter.display_name as reporter_name,assignee.display_name as assigned_name,
       resolver.display_name as resolved_name
     from moderation_reports r
     left join users reporter on reporter.id=r.reporter_id
     left join users assignee on assignee.id=r.assigned_to
     left join users resolver on resolver.id=r.resolved_by
     where ($1='' or r.status=$1)
     order by case r.status when 'open' then 0 when 'triaged' then 1 else 2 end,r.created_at desc
     limit 100`,
    [status],
  );
  return json(response, 200, {
    data: {
      reports: result.rows.map(row => ({
        id: row.id,
        reporter: { id: row.reporter_id, displayName: row.reporter_name || "Former member" },
        targetType: row.target_type,
        targetId: row.target_id,
        reasonCode: row.reason_code,
        details: row.details || row.reason,
        status: row.status,
        assignedTo: row.assigned_to ? { id: row.assigned_to, displayName: row.assigned_name } : null,
        resolutionNote: row.resolution_note,
        resolvedBy: row.resolved_by ? { id: row.resolved_by, displayName: row.resolved_name } : null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        resolvedAt: row.resolved_at,
      })),
    },
  }, requestId) || true;
}

async function updateReport(reportId, request, response, requestId) {
  validateUuid(reportId, "reportId");
  const currentActor = await actor();
  requireRole(currentActor, "moderator");
  consumeRateLimit(currentActor.id, "moderation", 120, 60 * 60 * 1000);
  const body = await readBody(request);
  rejectClientIdentity(body);
  const status = String(body.status || "");
  if (!["triaged", "resolved", "dismissed"].includes(status)) throw new ApiError(422, "validation_error", "Status must be triaged, resolved or dismissed");
  const resolutionNote = body.resolutionNote == null || body.resolutionNote === ""
    ? null
    : validatePlainText(body.resolutionNote, { field: "resolutionNote", min: 3, max: 2000 });
  const updated = await transaction(async client => {
    const report = await client.query("select * from moderation_reports where id=$1 for update", [reportId]);
    if (!report.rowCount) throw new ApiError(404, "report_not_found", "Report not found");
    const result = await client.query(
      `update moderation_reports
       set status=$2,assigned_to=coalesce(assigned_to,$3),
           resolved_by=case when $2 in ('resolved','dismissed') then $3 else null end,
           resolution_note=$4,resolved_at=case when $2 in ('resolved','dismissed') then now() else null end,
           updated_at=now()
       where id=$1 returning *`,
      [reportId, status, currentActor.id, resolutionNote],
    );
    await client.query(
      `insert into forum_moderation_actions(actor_id,target_type,target_id,action,reason,metadata)
       values($1,'report',$2,$3,$4,$5::jsonb)`,
      [currentActor.id, reportId, status === "dismissed" ? "dismiss_report" : "resolve_report", resolutionNote, JSON.stringify({ status })],
    );
    return result.rows[0];
  });
  return json(response, 200, {
    data: {
      id: updated.id,
      status: updated.status,
      resolutionNote: updated.resolution_note,
      resolvedAt: updated.resolved_at,
    },
  }, requestId) || true;
}

async function updateThread(threadId, request, response, requestId) {
  validateUuid(threadId, "threadId");
  const currentActor = await actor();
  requireRole(currentActor, "moderator");
  const body = await readBody(request);
  rejectClientIdentity(body);
  if (typeof body.locked !== "boolean") throw new ApiError(422, "validation_error", "locked must be true or false");
  const result = await transaction(async client => {
    const updated = await client.query("update forum_threads set locked=$2,updated_at=now() where id=$1 and status='visible' returning *", [threadId, body.locked]);
    if (!updated.rowCount) throw new ApiError(404, "thread_not_found", "Thread not found");
    await client.query(
      `insert into forum_moderation_actions(actor_id,target_type,target_id,action,reason)
       values($1,'thread',$2,$3,$4)`,
      [currentActor.id, threadId, body.locked ? "lock" : "unlock", body.reason ? String(body.reason).slice(0, 1000) : null],
    );
    return updated.rows[0];
  });
  return json(response, 200, { data: { id: result.id, locked: result.locked } }, requestId) || true;
}

async function deleteThread(threadId, response, requestId) {
  validateUuid(threadId, "threadId");
  const currentActor = await actor();
  const result = await transaction(async client => {
    const existing = await client.query("select id,author_id,status from forum_threads where id=$1 for update", [threadId]);
    if (!existing.rowCount || existing.rows[0].status !== "visible") throw new ApiError(404, "thread_not_found", "Thread not found");
    if (existing.rows[0].author_id !== currentActor.id && roleLevel(currentActor.role) < roleLevel("moderator")) {
      throw new ApiError(403, "not_thread_owner", "Only the thread author or a moderator may remove this thread");
    }
    await client.query("update forum_threads set status='deleted',deleted_at=now(),updated_at=now() where id=$1", [threadId]);
    await client.query("update forum_posts set status='deleted',deleted_at=coalesce(deleted_at,now()) where thread_id=$1", [threadId]);
    await client.query(
      `insert into forum_moderation_actions(actor_id,target_type,target_id,action,reason)
       values($1,'thread',$2,'hide','Thread removed')`,
      [currentActor.id, threadId],
    );
    return existing.rows[0];
  });
  return json(response, 200, { data: { id: result.id, deleted: true } }, requestId) || true;
}

function sendApiError(response, requestId, error) {
  return json(response, error.status, {
    error: {
      code: error.code,
      message: error.message,
      details: error.details,
    },
  }, requestId) || true;
}

export async function forumRouter(request, response, requestId, url = new URL(request.url, "http://local")) {
  const path = url.pathname;
  const threadPosts = path.match(/^\/v1\/threads\/([0-9a-f-]+)\/posts$/i);
  const threadToggle = path.match(/^\/v1\/threads\/([0-9a-f-]+)\/(bookmark|follow)$/i);
  const acceptedAnswer = path.match(/^\/v1\/threads\/([0-9a-f-]+)\/accepted-answer$/i);
  const threadByNumber = path.match(/^\/v1\/threads\/by-number\/([0-9]+)$/i);
  const threadDetail = path.match(/^\/v1\/threads\/([0-9a-f-]+)$/i);
  const memberProfile = path.match(/^\/v1\/members\/([0-9a-f-]+)$/i);
  const moderationReport = path.match(/^\/v1\/moderation\/reports\/([0-9a-f-]+)$/i);
  const isForumPath = path === "/v1/forums" || path === "/v1/threads" || path === "/v1/reactions" ||
    path === "/v1/reports" || path === "/v1/moderation/reports" || threadPosts || threadToggle ||
    acceptedAnswer || threadByNumber || threadDetail || memberProfile || moderationReport;
  if (!isForumPath) return false;
  try {
    if (request.method === "GET" && path === "/v1/forums") return await listForums(response, requestId);
    if (request.method === "GET" && path === "/v1/threads") return await listThreads(url, response, requestId);
    if (request.method === "POST" && path === "/v1/threads") return await createThread(request, response, requestId);
    if (request.method === "GET" && threadByNumber) return await getThreadByNumber(threadByNumber[1], response, requestId);
    if (request.method === "GET" && threadDetail) return await getThread(threadDetail[1], response, requestId);
    if (request.method === "GET" && memberProfile) return await getMemberProfile(memberProfile[1], response, requestId);
    if (request.method === "PATCH" && threadDetail) return await updateThread(threadDetail[1], request, response, requestId);
    if (request.method === "DELETE" && threadDetail) return await deleteThread(threadDetail[1], response, requestId);
    if (request.method === "POST" && threadPosts) return await createPost(threadPosts[1], request, response, requestId);
    if (request.method === "PUT" && path === "/v1/reactions") return await setReaction(request, response, requestId);
    if (request.method === "PUT" && threadToggle) return await setThreadToggle(threadToggle[2], threadToggle[1], request, response, requestId);
    if (request.method === "PUT" && acceptedAnswer) return await setAcceptedAnswer(acceptedAnswer[1], request, response, requestId);
    if (request.method === "POST" && path === "/v1/reports") return await createReport(request, response, requestId);
    if (request.method === "GET" && path === "/v1/moderation/reports") return await listReports(url, response, requestId);
    if (request.method === "PATCH" && moderationReport) return await updateReport(moderationReport[1], request, response, requestId);
    throw new ApiError(405, "method_not_allowed", "Method not allowed");
  } catch (error) {
    if (error instanceof ApiError) return sendApiError(response, requestId, error);
    throw error;
  }
}
