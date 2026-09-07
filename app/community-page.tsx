"use client";

import {
  FormEvent,
  KeyboardEvent as ReactKeyboardEvent,
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Bold,
  Bookmark,
  CircleCheck,
  Code2,
  Eye,
  Heading3,
  Image as ImageIcon,
  Italic,
  Link2,
  List,
  ListOrdered,
  MessageSquareQuote,
  Smile,
  Strikethrough,
  Underline,
  UserRound,
} from "lucide-react";

const COMMUNITY_API = "/api/community";
const LOCAL_MEMBER = {
  id: "00000000-0000-0000-0000-000000000001",
  name: "Fahad",
  handle: "local_builder",
  role: "admin",
};

type ForumGroup = "Design & equipment" | "General discussion" | "News & promotions" | "Solar systems" | "Marketplace" | "Off-topic";
type SortMode = "latest" | "top" | "unanswered" | "following" | "bookmarked";
type TimeRange = "1d" | "7d" | "30d" | "6m" | "1y" | "all";
type TopicType = "question" | "discussion" | "build" | "product" | "deal" | "sale";
type ReactionKind = "like" | "dislike" | "helpful" | "thanks" | "insightful" | "field-tested";
type CommunityTestTheme = "editorial" | "editorial-taupe" | "dusk";
type CommunityTestMode = "light" | "dark";
type CommunityTestLayout = "technical" | "editorial" | "mosaic";
type ReplyFormat = "bold" | "italic" | "underline" | "strike" | "heading" | "bullets" | "numbered" | "quote" | "code" | "link" | "image" | "smile";

type Member = {
  id: string;
  name: string;
  handle: string;
  role: string;
  reputation: number;
  location?: string;
};

type LatestActivity = {
  threadId?: string;
  title: string;
  author: string;
  at: string;
};

type ForumCategory = {
  slug: string;
  name: string;
  description: string;
  group: ForumGroup;
  icon: string;
  accent: string;
  threadCount: number;
  postCount: number;
  latest?: LatestActivity;
};

type ThreadSummary = {
  id: string;
  publicNumber: number;
  title: string;
  excerpt: string;
  categorySlug: string;
  categoryName: string;
  topicType: TopicType;
  author: Member;
  tags: string[];
  replyCount: number;
  viewCount: number;
  reactionCount: number;
  createdAt: string;
  lastActivityAt: string;
  lastAuthor?: string;
  pinned: boolean;
  solved: boolean;
  locked: boolean;
  bookmarked: boolean;
  followed: boolean;
};

type ReactionState = Record<ReactionKind, number>;

type ForumPost = {
  id: string;
  author: Member;
  body: string;
  createdAt: string;
  updatedAt?: string;
  parentId?: string;
  reactions: ReactionState;
  myReaction?: ReactionKind;
  accepted: boolean;
  isOriginal: boolean;
};

type ThreadDetail = ThreadSummary & {
  body: string;
  originalPost: ForumPost;
  posts: ForumPost[];
};

type ModerationReport = {
  id: string;
  targetType: string;
  targetId: string;
  reason: string;
  details?: string;
  reporter?: string;
  status: string;
  createdAt: string;
  targetTitle?: string;
};

type ComposerValues = {
  topicType: TopicType;
  category: string;
  title: string;
  tags: string;
  body: string;
};

type ReportTarget = {
  type: "thread" | "post";
  id: string;
  label: string;
};

type MemberProfile = {
  member: Member & { joinedAt?: string };
  stats: { topics: number; posts: number; reactionsReceived: number };
  topics: ThreadSummary[];
  posts: Array<{ id: string; threadId: string; threadTitle: string; categoryName: string; body: string; createdAt: string }>;
};

const replyFormattingTools = [
  { id: "bold", label: "Bold", Icon: Bold },
  { id: "italic", label: "Italic", Icon: Italic },
  { id: "underline", label: "Underline", Icon: Underline },
  { id: "strike", label: "Strikethrough", Icon: Strikethrough },
  { id: "heading", label: "Heading", Icon: Heading3 },
  { id: "bullets", label: "Bulleted list", Icon: List },
  { id: "numbered", label: "Numbered list", Icon: ListOrdered },
  { id: "quote", label: "Quote", Icon: MessageSquareQuote },
  { id: "code", label: "Code block", Icon: Code2 },
  { id: "link", label: "Insert link", Icon: Link2 },
  { id: "image", label: "Insert image link", Icon: ImageIcon },
  { id: "smile", label: "Insert smile", Icon: Smile },
] satisfies Array<{ id: ReplyFormat; label: string; Icon: typeof Bold }>;

const categoryBlueprints: ForumCategory[] = [
  { slug: "forum-help", name: "Announcements", description: "Community rules, forum changes, posting help and important notices.", group: "General discussion", icon: "◎", accent: "#73a7ff", threadCount: 0, postCount: 0 },
  { slug: "diy-general", name: "DIY Solar General", description: "Broad DIY solar questions, planning discussions and lessons learned.", group: "General discussion", icon: "☀", accent: "#f3c647", threadCount: 0, postCount: 0 },
  { slug: "showcase", name: "Show & Tell", description: "Completed systems, works in progress, equipment rooms and measured results.", group: "General discussion", icon: "▣", accent: "#53e38e", threadCount: 0, postCount: 0 },
  { slug: "online-deals", name: "Online Deals", description: "Community-found price drops, coupons and stock alerts with dates and evidence.", group: "News & promotions", icon: "↓", accent: "#53e38e", threadCount: 0, postCount: 0 },
  { slug: "new-products", name: "New Products", description: "New hardware, firmware releases, teardowns and early field observations.", group: "News & promotions", icon: "✦", accent: "#73a7ff", threadCount: 0, postCount: 0 },
  { slug: "vendor-reviews", name: "Vendor Reviews", description: "Documented buying experiences, support outcomes and retailer feedback.", group: "News & promotions", icon: "★", accent: "#f29d49", threadCount: 0, postCount: 0 },
  { slug: "panels-arrays", name: "Solar Panels", description: "Modules, datasheets, shade, string layout, mismatch and array performance.", group: "Solar systems", icon: "▦", accent: "#f3c647", threadCount: 0, postCount: 0 },
  { slug: "batteries-storage", name: "Batteries", description: "Cells, listed storage systems, rack batteries, BMS settings and safe enclosures.", group: "Solar systems", icon: "▤", accent: "#53e38e", threadCount: 0, postCount: 0 },
  { slug: "inverters-chargers", name: "Inverters", description: "Off-grid, hybrid and grid-interactive inverter equipment and commissioning.", group: "Solar systems", icon: "⌁", accent: "#f29d49", threadCount: 0, postCount: 0 },
  { slug: "charge-controllers", name: "Charge Controllers", description: "MPPT and PWM controller sizing, configuration, limits and troubleshooting.", group: "Solar systems", icon: "↯", accent: "#73a7ff", threadCount: 0, postCount: 0 },
  { slug: "roof-mounting", name: "Mounting Hardware", description: "Roof, ground, pole and canopy attachments, rails, flashing and structures.", group: "Solar systems", icon: "⌂", accent: "#f3c647", threadCount: 0, postCount: 0 },
  { slug: "generators", name: "Generators", description: "Fuel backup generators, auto-start, transfer equipment and integration.", group: "Solar systems", icon: "G", accent: "#ed655d", threadCount: 0, postCount: 0 },
  { slug: "tools", name: "Tools & Test Equipment", description: "Meters, scopes, crimpers, testers and field equipment recommendations.", group: "Solar systems", icon: "T", accent: "#53e38e", threadCount: 0, postCount: 0 },
  { slug: "software", name: "Software", description: "Monitoring, automation, firmware, communications and open-source projects.", group: "Solar systems", icon: "S", accent: "#73a7ff", threadCount: 0, postCount: 0 },
  { slug: "solar-for-sale", name: "Solar Panels for Sale", description: "Member listings for personally owned solar modules.", group: "Marketplace", icon: "$", accent: "#f3c647", threadCount: 0, postCount: 0 },
  { slug: "batteries-for-sale", name: "Batteries for Sale", description: "Member listings for batteries, cells, racks and related storage equipment.", group: "Marketplace", icon: "$", accent: "#53e38e", threadCount: 0, postCount: 0 },
  { slug: "inverters-for-sale", name: "Inverters for Sale", description: "Member listings for inverters, all-in-one units and power electronics.", group: "Marketplace", icon: "$", accent: "#f29d49", threadCount: 0, postCount: 0 },
  { slug: "for-sale", name: "Other Equipment for Sale", description: "Member listings for tools, wire, racking and miscellaneous equipment.", group: "Marketplace", icon: "$", accent: "#73a7ff", threadCount: 0, postCount: 0 },
  { slug: "humor", name: "Humor", description: "Solar jokes, memes and lighthearted workshop moments.", group: "Off-topic", icon: "☺", accent: "#f3c647", threadCount: 0, postCount: 0 },
  { slug: "random-no-politics", name: "Random — No Politics", description: "General conversation with politics and political arguments excluded.", group: "Off-topic", icon: "•", accent: "#87938d", threadCount: 0, postCount: 0 },
  { slug: "ranting", name: "Ranting", description: "A place to vent about projects and products while keeping it civil.", group: "Off-topic", icon: "!", accent: "#ed655d", threadCount: 0, postCount: 0 },
];

const communityTestThemes: Array<{ id: CommunityTestTheme; name: string; note: string; colors: string[] }> = [
  { id: "editorial", name: "Editorial navy", note: "Soft beige, navy ink and calm blue highlights.", colors: ["#f2eadc", "#183b67", "#537aa5", "#fffaf1"] },
  { id: "editorial-taupe", name: "Editorial taupe", note: "The same navy system on a slightly deeper, lower-glare beige.", colors: ["#ddd2c1", "#183b67", "#537aa5", "#f5eee3"] },
  { id: "dusk", name: "Blue dusk", note: "Lower-glare slate blue with clear cyan and gold signals.", colors: ["#202b3d", "#2d3b52", "#73b9dc", "#e1b85b"] },
];

const communityTestLayouts: Array<{ id: CommunityTestLayout; name: string; note: string }> = [
  { id: "technical", name: "Technical grid", note: "Dense, familiar forum rows" },
  { id: "editorial", name: "Editorial cards", note: "Type-led cards and breathing room" },
  { id: "mosaic", name: "Color bands", note: "Bold sectional rhythm and signals" },
];

const topicTypes: Array<{ value: TopicType; label: string; short: string }> = [
  { value: "question", label: "Technical question", short: "Ask for a specific, verifiable answer." },
  { value: "discussion", label: "Discussion", short: "Compare approaches or explore an idea." },
  { value: "build", label: "Build log", short: "Document a system and what you learned." },
  { value: "product", label: "Product report", short: "Share specifications or field experience." },
  { value: "deal", label: "Deal", short: "Post a time-sensitive offer with evidence." },
  { value: "sale", label: "For sale", short: "List personally owned equipment responsibly." },
];

const composerGuidance: Record<TopicType, { title: string; checklist: string[] }> = {
  question: {
    title: "Make the electrical context reproducible",
    checklist: ["State AC/DC voltage and system architecture.", "Include exact model numbers and the values you measured.", "Explain what you already checked and what remains energized."],
  },
  discussion: {
    title: "Give the conversation a useful boundary",
    checklist: ["State the outcome you are considering.", "Separate preferences from verified requirements.", "Link a manual or authority source when making a technical claim."],
  },
  build: {
    title: "Leave a build record others can audit",
    checklist: ["Include system size, location/climate and one-line architecture.", "List major equipment and protection devices.", "Call out inspection results, revisions and unresolved limitations."],
  },
  product: {
    title: "Separate facts from impressions",
    checklist: ["Use the full manufacturer and model name.", "Include firmware/version and measured conditions.", "Disclose whether you purchased, received or sell the product."],
  },
  deal: {
    title: "Help members verify the deal",
    checklist: ["Include retailer, final price, shipping and expiration.", "Link the product—not an undisclosed referral redirect.", "Note condition, region, coupon requirements and stock uncertainty."],
  },
  sale: {
    title: "Create a safer classified listing",
    checklist: ["State your region, asking price, condition and ownership.", "Show test results without exposing personal information.", "Never request gift-card, crypto or irreversible off-platform payment."],
  },
};

const reactionOptions: Array<{ kind: ReactionKind; icon: string; label: string }> = [
  { kind: "like", icon: "👍", label: "Like" },
  { kind: "dislike", icon: "👎", label: "Dislike" },
  { kind: "helpful", icon: "😂", label: "Laugh" },
  { kind: "thanks", icon: "😮", label: "Surprised" },
  { kind: "insightful", icon: "🎉", label: "Celebrate" },
  { kind: "field-tested", icon: "🧪", label: "Field-tested" },
];

const roleLabels: Record<string, string> = {
  admin: "Local administrator",
  moderator: "Moderator",
  trusted_member: "Trusted builder",
  professional: "Verified professional",
  member: "Member",
};

const topicTypeToApi: Record<TopicType, string> = {
  question: "question",
  discussion: "discussion",
  build: "showcase",
  product: "new_product",
  deal: "deal",
  sale: "listing",
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : value == null ? fallback : String(value);
}

function number(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bool(value: unknown): boolean {
  return value === true || value === 1 || value === "true";
}

function slugify(value: string): string {
  return value.toLowerCase().trim().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function threadPath(thread: { id: string; title: string; publicNumber: number }, designLab = false): string {
  const number = String(thread.publicNumber).padStart(2, "0");
  if (designLab) return `/community-test?thread=${number}`;
  return `/threads/${slugify(thread.title) || "discussion"}-${number}`;
}

function threadReferenceFromPath(pathname: string): string {
  const segment = decodeURIComponent(pathname.split("/").filter(Boolean).at(-1) || "");
  const uuid = segment.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i);
  if (uuid) return uuid[1];
  return segment.match(/-([0-9]+)$/)?.[1] || "";
}

function unpack(payload: unknown): unknown {
  const record = asRecord(payload);
  return "data" in record ? record.data : payload;
}

function normalizeMember(value: unknown, fallbackName = "Solar builder"): Member {
  const source = asRecord(value);
  const name = text(source.displayName ?? source.display_name ?? source.name ?? source.username, fallbackName);
  return {
    id: text(source.id, slugify(name)),
    name,
    handle: text(source.handle ?? source.username, slugify(name).replace(/-/g, "_")),
    role: text(source.role, "member"),
    reputation: number(source.reputation ?? source.reputation_count ?? source.points),
    location: text(source.location) || undefined,
  };
}

function normalizeCategory(value: unknown): ForumCategory {
  const source = asRecord(value);
  const name = text(source.name ?? source.title, "Community board");
  const incomingSlug = text(source.slug ?? source.id, slugify(name));
  const blueprint = categoryBlueprints.find(item => item.slug === incomingSlug || slugify(item.name) === slugify(name));
  const latestSource = asRecord(source.latest ?? source.latestThread ?? source.latest_thread);
  const group = text(source.group ?? source.groupName ?? source.group_name ?? source.section, blueprint?.group || "General discussion") as ForumGroup;
  return {
    ...(blueprint || {
      slug: incomingSlug,
      name,
      description: "",
      group,
      icon: "◇",
      accent: "#53e38e",
      threadCount: 0,
      postCount: 0,
    }),
    slug: incomingSlug,
    name,
    description: text(source.description, blueprint?.description || "Technical discussions from the Solar4U community."),
    group: ["General discussion", "News & promotions", "Solar systems", "Marketplace", "Off-topic"].includes(group) ? group : blueprint?.group || "General discussion",
    icon: text(source.icon, blueprint?.icon || "◇"),
    accent: text(source.accent ?? source.color, blueprint?.accent || "#53e38e"),
    threadCount: number(source.threadCount ?? source.thread_count ?? source.threads),
    postCount: number(source.postCount ?? source.post_count ?? source.messages ?? source.posts),
    latest: Object.keys(latestSource).length ? {
      threadId: text(latestSource.threadId ?? latestSource.thread_id ?? latestSource.id) || undefined,
      title: text(latestSource.title, "Latest activity"),
      author: text(latestSource.authorName ?? latestSource.author_name ?? asRecord(latestSource.author).name, "community member"),
      at: text(latestSource.at ?? latestSource.last_activity_at ?? latestSource.created_at),
    } : undefined,
  };
}

function normalizeTopicType(value: unknown): TopicType {
  const apiValue = text(value, "discussion");
  const candidate = ({ showcase: "build", new_product: "product", listing: "sale" }[apiValue] || apiValue) as TopicType;
  return topicTypes.some(option => option.value === candidate) ? candidate : "discussion";
}

function normalizeThread(value: unknown): ThreadSummary {
  const source = asRecord(value);
  const categorySource = asRecord(source.category);
  const categoryName = text(source.categoryName ?? source.category_name ?? categorySource.name ?? source.category, "DIY General");
  const categorySlug = text(source.categorySlug ?? source.category_slug ?? categorySource.slug, slugify(categoryName));
  const body = text(source.excerpt ?? source.body);
  return {
    id: text(source.id, `local-${Math.random().toString(36).slice(2)}`),
    publicNumber: number(source.publicNumber ?? source.public_number),
    title: text(source.title, "Untitled discussion"),
    excerpt: body.length > 220 ? `${body.slice(0, 217)}…` : body,
    categorySlug,
    categoryName,
    topicType: normalizeTopicType(source.topicType ?? source.topic_type ?? source.kind ?? source.type),
    author: normalizeMember(source.author ?? { id: source.author_id, name: source.author_name, role: source.author_role }),
    tags: asArray(source.tags).map(item => text(item)).filter(Boolean),
    replyCount: number(source.replyCount ?? source.reply_count ?? source.replies),
    viewCount: number(source.viewCount ?? source.view_count ?? source.views),
    reactionCount: number(source.reactionCount ?? source.reaction_count ?? source.reactions),
    createdAt: text(source.createdAt ?? source.created_at),
    lastActivityAt: text(source.lastActivityAt ?? source.last_activity_at ?? source.updated_at ?? source.created_at),
    lastAuthor: text(source.lastAuthor ?? source.last_author ?? source.last_author_name) || undefined,
    pinned: bool(source.pinned ?? source.sticky),
    solved: bool(source.solved ?? source.hasAcceptedAnswer ?? source.has_accepted_answer ?? source.acceptedPostId ?? source.accepted_post_id),
    locked: bool(source.locked),
    bookmarked: bool(source.bookmarked ?? source.viewer_bookmarked),
    followed: bool(source.followed ?? source.viewer_following),
  };
}

function emptyReactions(): ReactionState {
  return { like: 0, dislike: 0, helpful: 0, thanks: 0, insightful: 0, "field-tested": 0 };
}

function normalizeReactionKind(value: unknown): ReactionKind | undefined {
  const candidate = text(value).replace("_", "-") as ReactionKind;
  return reactionOptions.some(option => option.kind === candidate) ? candidate : undefined;
}

function normalizeReactions(value: unknown): ReactionState {
  const result = emptyReactions();
  if (Array.isArray(value)) {
    value.forEach(item => {
      const reaction = asRecord(item);
      const kind = normalizeReactionKind(reaction.kind ?? reaction.reaction ?? reaction.type);
      if (kind) result[kind] = number(reaction.count, result[kind] + 1);
    });
    return result;
  }
  const source = asRecord(value);
  reactionOptions.forEach(({ kind }) => {
    result[kind] = number(source[kind] ?? source[kind.replace("-", "_")]);
  });
  return result;
}

function normalizePost(value: unknown, isOriginal = false): ForumPost {
  const source = asRecord(value);
  return {
    id: text(source.id, `post-${Math.random().toString(36).slice(2)}`),
    author: normalizeMember(source.author ?? { id: source.author_id, name: source.author_name, role: source.author_role }),
    body: text(source.body ?? source.content),
    createdAt: text(source.createdAt ?? source.created_at),
    updatedAt: text(source.updatedAt ?? source.updated_at) || undefined,
    parentId: text(source.parentId ?? source.parent_id) || undefined,
    reactions: normalizeReactions(source.reactions ?? source.reactionSummary ?? source.reaction_summary ?? source.reaction_counts),
    myReaction: normalizeReactionKind(source.myReaction ?? source.my_reaction ?? source.viewerReaction ?? source.viewer_reaction),
    accepted: bool(source.accepted ?? source.isAccepted ?? source.is_accepted),
    isOriginal: bool(source.isOriginal ?? source.is_original) || isOriginal,
  };
}

function normalizeThreadDetail(payload: unknown): ThreadDetail {
  const unpacked = unpack(payload);
  const envelope = asRecord(unpacked);
  const source = asRecord(envelope.thread ?? unpacked);
  const summary = normalizeThread(source);
  const originalSource = asRecord(source.originalPost ?? source.original_post ?? envelope.originalPost ?? envelope.original_post);
  const body = text(source.body ?? originalSource.body);
  const originalPost = normalizePost(
    Object.keys(originalSource).length ? originalSource : {
      id: source.original_post_id ?? `thread-${summary.id}`,
      author: source.author,
      author_id: source.author_id,
      author_name: source.author_name,
      author_role: source.author_role,
      body,
      created_at: source.created_at,
      reactions: source.reactions,
    },
    true,
  );
  const rawPosts = asArray(source.posts ?? source.replies ?? envelope.posts ?? envelope.replies);
  const posts = rawPosts.map(item => normalizePost(item)).filter(post => post.id !== originalPost.id && !post.isOriginal);
  const viewer = asRecord(envelope.viewer);
  return {
    ...summary,
    body,
    bookmarked: bool(viewer.bookmarked ?? summary.bookmarked),
    followed: bool(viewer.following ?? viewer.followed ?? summary.followed),
    originalPost,
    posts,
  };
}

function normalizeReport(value: unknown): ModerationReport {
  const source = asRecord(value);
  return {
    id: text(source.id),
    targetType: text(source.targetType ?? source.target_type, "post"),
    targetId: text(source.targetId ?? source.target_id),
    reason: text(source.reason, "Other"),
    details: text(source.details ?? source.note) || undefined,
    reporter: text(source.reporter_name ?? asRecord(source.reporter).name) || undefined,
    status: text(source.status, "open"),
    createdAt: text(source.createdAt ?? source.created_at),
    targetTitle: text(source.targetTitle ?? source.target_title) || undefined,
  };
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${COMMUNITY_API}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers || {}) },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const record = asRecord(payload);
    throw new Error(text(record.message ?? record.error, `Request failed (${response.status})`));
  }
  return payload as T;
}

function formatCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}K`;
  return value.toLocaleString();
}

function relativeTime(value: string): string {
  if (!value) return "recently";
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return value;
  const seconds = Math.round((timestamp - Date.now()) / 1000);
  const absolute = Math.abs(seconds);
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (absolute < 60) return formatter.format(seconds, "second");
  if (absolute < 3_600) return formatter.format(Math.round(seconds / 60), "minute");
  if (absolute < 86_400) return formatter.format(Math.round(seconds / 3_600), "hour");
  if (absolute < 2_592_000) return formatter.format(Math.round(seconds / 86_400), "day");
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: new Date(value).getFullYear() === new Date().getFullYear() ? undefined : "numeric" }).format(new Date(value));
}

function categoryMeta(slug: string): ForumCategory {
  return categoryBlueprints.find(category => category.slug === slug) || {
    slug,
    name: slug.split("-").map(word => word[0]?.toUpperCase() + word.slice(1)).join(" "),
    description: "Solar4U community discussion.",
    group: "Design & equipment",
    icon: "◇",
    accent: "#53e38e",
    threadCount: 0,
    postCount: 0,
  };
}

function Avatar({ member, size = "medium" }: { member: Member; size?: "small" | "medium" | "large" }) {
  const identity = `${member.id}:${member.name}`;
  const tone = Array.from(identity).reduce((total, character) => total + character.charCodeAt(0), 0) % 6;
  return (
    <span className={`community-avatar ${size} tone-${tone}`} aria-hidden="true">
      <UserRound />
    </span>
  );
}

function ThreadBadges({ thread }: { thread: ThreadSummary }) {
  return (
    <span className="community-thread-badges">
      {thread.pinned && <span className="pin">PINNED</span>}
      {thread.solved && <span className="solved">SOLVED</span>}
      {thread.locked && <span className="locked">LOCKED</span>}
      <span>{topicTypes.find(option => option.value === thread.topicType)?.label || "Discussion"}</span>
    </span>
  );
}

function ForumDirectory({
  categories,
  onChoose,
}: {
  categories: ForumCategory[];
  onChoose: (slug: string) => void;
}) {
  const groups: Array<{ name: ForumGroup; description: string }> = [
    { name: "General discussion", description: "Community operations and broad DIY solar conversation" },
    { name: "News & promotions", description: "Products, manufacturer news, promotions and public deals" },
    { name: "Solar systems", description: "Design, equipment, installation, code and troubleshooting" },
    { name: "Marketplace", description: "Member listings and equipment wanted" },
    { name: "Off-topic", description: "The workshop conversation that does not fit elsewhere" },
  ];
  return (
    <section className="community-forum-index" aria-labelledby="forum-index-title">
      <header>
        <div><h2 id="forum-index-title">Solar4U forums</h2><p>Select the most specific board for your topic.</p></div>
        <span>Topics</span><span>Posts</span><span>Latest</span>
      </header>
      {groups.map(group => {
        const groupCategories = categories.filter(category => category.group === group.name);
        if (!groupCategories.length) return null;
        return (
          <section className="community-forum-group" key={group.name}>
            <header><h3>{group.name}</h3><p>{group.description}</p></header>
            {groupCategories.map(category => (
              <button className="community-forum-row" onClick={() => onChoose(category.slug)} key={category.slug}>
                <span className="forum-status-dot" aria-hidden="true" />
                <span className="forum-row-copy"><b>{category.name}</b><small>{category.description}</small></span>
                <span className="forum-row-count"><b>{formatCount(category.threadCount)}</b><small>topics</small></span>
                <span className="forum-row-count"><b>{formatCount(category.postCount)}</b><small>posts</small></span>
                <span className="forum-row-latest">
                  {category.latest?.title ? <><b>{category.latest.title}</b><small>{category.latest.author} · {relativeTime(category.latest.at)}</small></> : <><b>No recent topic</b><small>Start the first discussion</small></>}
                </span>
              </button>
            ))}
          </section>
        );
      })}
    </section>
  );
}

function ThreadList({
  threads,
  loading,
  error,
  onRetry,
  onOpen,
  detailed = false,
}: {
  threads: ThreadSummary[];
  loading: boolean;
  error: string;
  onRetry: () => void;
  onOpen: (thread: ThreadSummary) => void;
  detailed?: boolean;
}) {
  if (loading) {
    return <div className="community-loading-list" aria-label="Loading discussions">{Array.from({ length: 5 }).map((_, index) => <span key={index} />)}</div>;
  }
  if (error) {
    return (
      <div className="community-state-panel" role="alert">
        <span>!</span><h3>The discussion feed did not load.</h3><p>{error}</p>
        <button className="secondary-button" onClick={onRetry}>Try again</button>
      </div>
    );
  }
  if (!threads.length) {
    return <div className="community-state-panel"><span>◇</span><h3>No discussions match this view.</h3><p>Clear a filter or start a focused topic for the next builder.</p></div>;
  }
  return (
    <div className={detailed ? "community-thread-list detailed" : "community-thread-list recent"}>
      {detailed && (
        <div className="community-thread-column-head" aria-hidden="true">
          <span>Topic / thread starter</span><span>Replies · views · reactions</span><span>Last post</span>
        </div>
      )}
      {threads.map(thread => {
        const category = categoryMeta(thread.categorySlug);
        return (
          <article className="community-thread-row" key={thread.id}>
            <button className="community-thread-open" onClick={() => onOpen(thread)} aria-label={`Open discussion: ${thread.title}`}>
              <Avatar member={thread.author} />
              <span className="thread-row-copy">
                <ThreadBadges thread={thread} />
                <b className="thread-row-title">{thread.title}</b>
                {thread.excerpt && <span className="thread-row-excerpt">{thread.excerpt}</span>}
                <span className="thread-row-byline">
                  <strong>{thread.categoryName || category.name}</strong>
                  <span>by {thread.author.name}</span>
                  <span>{relativeTime(thread.createdAt)}</span>
                </span>
                {thread.tags.length > 0 && <span className="thread-row-tags">{thread.tags.slice(0, 4).map(tag => <em key={tag}>#{tag}</em>)}</span>}
              </span>
              <span className="thread-row-metrics">
                <span><b>{formatCount(thread.replyCount)}</b><small>replies</small></span>
                <span><b>{formatCount(thread.viewCount)}</b><small>views</small></span>
                <span><b>{formatCount(thread.reactionCount)}</b><small>reactions</small></span>
              </span>
              <span className="thread-row-activity">
                <small>LAST ACTIVITY</small>
                <b>{relativeTime(thread.lastActivityAt)}</b>
                <span>{thread.lastAuthor ? `by ${thread.lastAuthor}` : "View discussion"}</span>
              </span>
            </button>
          </article>
        );
      })}
    </div>
  );
}

function ComposerDialog({
  open,
  categories,
  initialCategory,
  onClose,
  onCreated,
}: {
  open: boolean;
  categories: ForumCategory[];
  initialCategory: string;
  onClose: () => void;
  onCreated: (thread: ThreadSummary) => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [values, setValues] = useState<ComposerValues>({ topicType: "question", category: initialCategory || "diy-general", title: "", tags: "", body: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => setValues(current => ({ ...current, category: initialCategory || current.category || "diy-general" })), 0);
    return () => window.clearTimeout(timer);
  }, [initialCategory, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape" && !submitting) onClose();
    };
    document.addEventListener("keydown", onKey);
    window.setTimeout(() => dialogRef.current?.querySelector<HTMLButtonElement>("button")?.focus(), 0);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, open, submitting]);

  if (!open) return null;
  const guidance = composerGuidance[values.topicType];
  const setField = <K extends keyof ComposerValues>(field: K, value: ComposerValues[K]) => setValues(current => ({ ...current, [field]: value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (values.title.trim().length < 8 || values.body.trim().length < 20) {
      setError("Use a descriptive title and at least 20 characters of context.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const payload = await api<unknown>("/threads", {
        method: "POST",
        body: JSON.stringify({
          topicType: values.topicType,
          kind: topicTypeToApi[values.topicType],
          category: values.category,
          categorySlug: values.category,
          title: values.title.trim(),
          tags: values.tags.split(",").map(tag => tag.trim().replace(/^#/, "")).filter(Boolean).slice(0, 5),
          body: values.body.trim(),
        }),
      });
      const created = asRecord(unpack(payload));
      const thread = normalizeThread(created.thread ?? created);
      setValues({ topicType: "question", category: values.category, title: "", tags: "", body: "" });
      onCreated(thread);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The discussion could not be created.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="community-dialog-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !submitting) onClose(); }}>
      <div className="community-dialog community-composer-dialog" role="dialog" aria-modal="true" aria-labelledby="new-topic-title" ref={dialogRef}>
        <header>
          <div><span className="eyebrow">NEW COMMUNITY TOPIC</span><h2 id="new-topic-title">Start a useful discussion</h2></div>
          <button className="community-icon-button" onClick={onClose} aria-label="Close new discussion dialog">×</button>
        </header>
        <form onSubmit={submit}>
          <fieldset className="community-topic-types">
            <legend>What are you posting?</legend>
            {topicTypes.map(option => (
              <button type="button" aria-pressed={values.topicType === option.value} className={values.topicType === option.value ? "active" : ""} onClick={() => setField("topicType", option.value)} key={option.value}>
                <b>{option.label}</b><small>{option.short}</small>
              </button>
            ))}
          </fieldset>
          <div className="community-composer-grid">
            <div className="community-composer-fields">
              <label>
                <span>Category</span>
                <select value={values.category} onChange={event => setField("category", event.target.value)} required>
                  {categories.map(category => <option value={category.slug} key={category.slug}>{category.name}</option>)}
                </select>
              </label>
              <label>
                <span>Title</span>
                <input value={values.title} onChange={event => setField("title", event.target.value)} maxLength={140} placeholder="Describe the equipment, symptom or decision" required />
                <small>{values.title.length}/140</small>
              </label>
              <label>
                <span>Tags <i>optional, comma separated</i></span>
                <input value={values.tags} onChange={event => setField("tags", event.target.value)} maxLength={120} placeholder="48v, victron, ground-mount" />
              </label>
              <label>
                <span>Details</span>
                <textarea value={values.body} onChange={event => setField("body", event.target.value)} rows={12} maxLength={12_000} placeholder="Include exact models, measurements, assumptions and what you have already tried." required />
                <small>{values.body.length.toLocaleString()}/12,000 · Plain text</small>
              </label>
            </div>
            <aside className="community-composer-guidance">
              <small>GOOD {values.topicType.toUpperCase()}</small>
              <h3>{guidance.title}</h3>
              <ol>{guidance.checklist.map((item, index) => <li key={item}><b>0{index + 1}</b><span>{item}</span></li>)}</ol>
              {(["deal", "sale"].includes(values.topicType) || ["promotions", "online-deals", "for-sale", "wanted"].includes(values.category)) && (
                <div className="community-market-warning"><b>Marketplace disclosure</b><p>State any vendor, affiliate or financial relationship. Solar4U does not verify listings, hold funds or guarantee products.</p></div>
              )}
              <div className="community-safety-warning"><b>Electrical safety</b><p>Do not encourage energized work. Identify hazardous voltage, isolation steps and when qualified professional review is required.</p></div>
            </aside>
          </div>
          {error && <p className="community-form-error" role="alert">{error}</p>}
          <footer>
            <span>Posts become part of a searchable local knowledge base.</span>
            <div><button type="button" className="secondary-button" onClick={onClose} disabled={submitting}>Cancel</button><button type="submit" className="primary-button" disabled={submitting}>{submitting ? "Publishing…" : "Publish discussion"}</button></div>
          </footer>
        </form>
      </div>
    </div>
  );
}

function ReportDialog({ target, onClose }: { target: ReportTarget | null; onClose: () => void }) {
  const [reason, setReason] = useState("unsafe_advice");
  const [details, setDetails] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!target) return;
    const onKey = (event: globalThis.KeyboardEvent) => event.key === "Escape" && status !== "sending" && onClose();
    document.addEventListener("keydown", onKey);
    window.setTimeout(() => ref.current?.querySelector<HTMLSelectElement>("select")?.focus(), 0);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, status, target]);

  if (!target) return null;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setStatus("sending");
    setError("");
    try {
      await api("/reports", { method: "POST", body: JSON.stringify({ targetType: target.type, targetId: target.id, reasonCode: reason, reason, details: details.trim() }) });
      setStatus("sent");
    } catch (requestError) {
      setStatus("idle");
      setError(requestError instanceof Error ? requestError.message : "The report could not be submitted.");
    }
  };
  return (
    <div className="community-dialog-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && status !== "sending") onClose(); }}>
      <div className="community-dialog community-report-dialog" role="dialog" aria-modal="true" aria-labelledby="report-title" ref={ref}>
        <header><div><span className="eyebrow">PRIVATE MODERATOR REPORT</span><h2 id="report-title">Report {target.label}</h2></div><button className="community-icon-button" onClick={onClose} aria-label="Close report dialog">×</button></header>
        {status === "sent" ? (
          <div className="community-report-sent"><span>✓</span><h3>Report added to the local moderation queue.</h3><p>Thank you for leaving a clear audit trail. A moderator can review the content and context.</p><button className="primary-button" onClick={onClose}>Done</button></div>
        ) : (
          <form onSubmit={submit}>
            <label><span>Reason</span><select value={reason} onChange={event => setReason(event.target.value)}><option value="unsafe_advice">Unsafe electrical advice</option><option value="spam">Spam or undisclosed promotion</option><option value="fraud">Suspicious sale or fraud risk</option><option value="harassment">Harassment or personal attack</option><option value="misinformation">Materially misleading technical claim</option><option value="other">Other</option></select></label>
            <label><span>Context for moderators <i>optional</i></span><textarea value={details} onChange={event => setDetails(event.target.value)} rows={5} maxLength={1_500} placeholder="Explain the specific sentence, risk or behavior." /></label>
            {error && <p className="community-form-error" role="alert">{error}</p>}
            <footer><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={status === "sending"}>{status === "sending" ? "Submitting…" : "Submit report"}</button></footer>
          </form>
        )}
      </div>
    </div>
  );
}

function MemberProfileDialog({
  member,
  onClose,
  onOpenThread,
}: {
  member: Member | null;
  onClose: () => void;
  onOpenThread: (thread: { id: string; title: string; publicNumber: number }) => void;
}) {
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!member) return;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const payload = unpack(await api<unknown>(`/members/${encodeURIComponent(member.id)}`));
        const source = asRecord(payload);
        const stats = asRecord(source.stats);
        const topics = asArray(source.topics).map(normalizeThread);
        const posts = asArray(source.posts).map(item => {
          const post = asRecord(item);
          return {
            id: text(post.id),
            threadId: text(post.threadId ?? post.thread_id),
            threadTitle: text(post.threadTitle ?? post.thread_title, "Discussion"),
            categoryName: text(post.categoryName ?? post.category_name, "Community"),
            body: text(post.body),
            createdAt: text(post.createdAt ?? post.created_at),
          };
        });
        setProfile({
          member: { ...normalizeMember(source.member), joinedAt: text(asRecord(source.member).joinedAt ?? asRecord(source.member).joined_at) },
          stats: {
            topics: number(stats.topics),
            posts: number(stats.posts),
            reactionsReceived: number(stats.reactionsReceived ?? stats.reactions_received),
          },
          topics,
          posts,
        });
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "This member profile could not be loaded.");
      } finally {
        setLoading(false);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [member]);

  if (!member) return null;
  return (
    <div className="community-dialog-backdrop member-profile-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="community-member-profile" role="dialog" aria-modal="true" aria-labelledby="member-profile-title">
        <header>
          <Avatar member={member} size="large" />
          <div><span className="eyebrow">MEMBER PROFILE</span><h2 id="member-profile-title">{member.name}</h2><p>@{member.handle} · {roleLabels[member.role] || "Member"}</p></div>
          <button className="community-icon-button" onClick={onClose} aria-label="Close member profile">×</button>
        </header>
        {loading ? <div className="member-profile-loading">Loading member activity…</div> : error ? <div className="community-state-panel" role="alert"><span>!</span><h3>Profile unavailable</h3><p>{error}</p></div> : profile && (
          <>
            <dl className="member-profile-stats">
              <div><dt>Topics</dt><dd>{profile.stats.topics}</dd></div>
              <div><dt>Posts</dt><dd>{profile.stats.posts}</dd></div>
              <div><dt>Reactions received</dt><dd>{profile.stats.reactionsReceived}</dd></div>
              <div><dt>Joined</dt><dd>{profile.member.joinedAt ? new Date(profile.member.joinedAt).toLocaleDateString() : "Local profile"}</dd></div>
            </dl>
            <div className="member-profile-history">
              <section>
                <h3>Topics started</h3>
                {profile.topics.length ? profile.topics.map(topic => <button onClick={() => onOpenThread(topic)} key={topic.id}><b>{topic.title}</b><small>{topic.categoryName} · {relativeTime(topic.createdAt)}</small></button>) : <p>No topics started yet.</p>}
              </section>
              <section>
                <h3>Recent replies</h3>
                {profile.posts.length ? profile.posts.map(post => <button onClick={() => { window.location.href = `/community?thread=${encodeURIComponent(post.threadId)}`; }} key={post.id}><b>{post.threadTitle}</b><span>{post.body}</span><small>{post.categoryName} · {relativeTime(post.createdAt)}</small></button>) : <p>No replies posted yet.</p>}
              </section>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function renderForumInline(line: string): ReactNode[] {
  const parts = line.split(/(\*\*[^*]+\*\*|~~[^~]+~~|<u>[^<]+<\/u>|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^)]+\)|\*[^*]+\*)/g);
  return parts.filter(Boolean).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("~~") && part.endsWith("~~")) return <del key={index}>{part.slice(2, -2)}</del>;
    if (part.startsWith("<u>") && part.endsWith("</u>")) return <u key={index}>{part.slice(3, -4)}</u>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={index}>{part.slice(1, -1)}</code>;
    if (part.startsWith("*") && part.endsWith("*")) return <em key={index}>{part.slice(1, -1)}</em>;
    const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/);
    if (link) return <a href={link[2]} target="_blank" rel="noreferrer" key={index}>{link[1]}</a>;
    return part;
  });
}

function ForumFormattedText({ body }: { body: string }) {
  const rendered = body.split("\n").reduce<{ inCodeBlock: boolean; nodes: ReactNode[] }>((state, line, index) => {
    if (line.trim() === "```") return { ...state, inCodeBlock: !state.inCodeBlock };
    let node: ReactNode;
    if (state.inCodeBlock) node = <pre key={index}><code>{line || " "}</code></pre>;
    else if (line.startsWith("### ")) node = <h3 key={index}>{renderForumInline(line.slice(4))}</h3>;
    else if (line.startsWith("> ")) node = <blockquote key={index}>{renderForumInline(line.slice(2))}</blockquote>;
    else if (/^- /.test(line)) node = <div className="community-rich-list-item" key={index}><span>•</span><p>{renderForumInline(line.slice(2))}</p></div>;
    else {
      const numbered = line.match(/^(\d+)\. (.*)$/);
      if (numbered) node = <div className="community-rich-list-item" key={index}><span>{numbered[1]}.</span><p>{renderForumInline(numbered[2])}</p></div>;
      else node = line ? <p key={index}>{renderForumInline(line)}</p> : <br key={index} />;
    }
    return { ...state, nodes: [...state.nodes, node] };
  }, { inCodeBlock: false, nodes: [] });
  return (
    <div className="community-formatted-text">
      {rendered.nodes}
    </div>
  );
}

function ReactionBar({
  threadId,
  post,
  onUpdate,
}: {
  threadId: string;
  post: ForumPost;
  onUpdate: (postId: string, reactions: ReactionState, myReaction?: ReactionKind) => void;
}) {
  const [busy, setBusy] = useState<ReactionKind | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const react = async (kind: ReactionKind) => {
    if (busy) return;
    setBusy(kind);
    const previous = post.myReaction;
    const next = previous === kind ? undefined : kind;
    const reactions = { ...post.reactions };
    if (previous) reactions[previous] = Math.max(0, reactions[previous] - 1);
    if (next) reactions[next] += 1;
    onUpdate(post.id, reactions, next);
    try {
      const payload = await api<unknown>("/reactions", { method: "PUT", body: JSON.stringify({ threadId, postId: post.id, reaction: next === "field-tested" ? "field_tested" : next ?? null }) });
      const record = asRecord(unpack(payload));
      if (record.reactions || record.reactionSummary || record.reaction_summary || record.reaction_counts) onUpdate(post.id, normalizeReactions(record.reactions ?? record.reactionSummary ?? record.reaction_summary ?? record.reaction_counts), normalizeReactionKind(record.myReaction ?? record.my_reaction ?? record.viewerReaction ?? record.viewer_reaction) || next);
    } catch {
      onUpdate(post.id, post.reactions, previous);
    } finally {
      setBusy(null);
      setMoreOpen(false);
    }
  };
  const selected = reactionOptions.find(option => option.kind === post.myReaction);
  const total = reactionOptions.reduce((sum, option) => sum + post.reactions[option.kind], 0);
  return (
    <div className="community-reaction-bar" aria-label="React to this post">
      <div className="community-emoji-picker">
        <button className={selected ? "active emoji-trigger" : "emoji-trigger"} onClick={() => setMoreOpen(open => !open)} aria-expanded={moreOpen} disabled={busy !== null}>
          <span>{selected?.icon || "👍"}</span><b>{selected?.label || "Like"}</b>{total > 0 && <small>{total}</small>}
        </button>
        {moreOpen && <div className="community-emoji-menu">
          {reactionOptions.map(option => (
            <button className={post.myReaction === option.kind ? "active" : ""} disabled={busy !== null} onClick={() => react(option.kind)} title={option.label} aria-label={option.label} key={option.kind}>
              <span>{option.icon}</span><b>{option.label}</b>{post.reactions[option.kind] > 0 && <small>{post.reactions[option.kind]}</small>}
            </button>
          ))}
        </div>}
      </div>
    </div>
  );
}

function PostCard({
  thread,
  post,
  index,
  canAccept,
  onQuote,
  onReply,
  onReport,
  onAccept,
  onBookmark,
  onReactionUpdate,
  onMember,
  parent,
}: {
  thread: ThreadDetail;
  post: ForumPost;
  index: number;
  canAccept: boolean;
  onQuote: (post: ForumPost) => void;
  onReply: (post: ForumPost) => void;
  onReport: (target: ReportTarget) => void;
  onAccept: (postId: string) => void;
  onBookmark: () => void;
  onReactionUpdate: (postId: string, reactions: ReactionState, myReaction?: ReactionKind) => void;
  onMember: (member: Member) => void;
  parent?: ForumPost;
}) {
  const role = roleLabels[post.author.role] || post.author.role.replace(/_/g, " ");
  const [shareState, setShareState] = useState("");
  const sharePost = async () => {
    const url = `${window.location.origin}${window.location.pathname}${window.location.search}#post-${post.id}`;
    try {
      if (navigator.share) await navigator.share({ title: thread.title, url });
      else await navigator.clipboard.writeText(url);
      setShareState("Copied");
      window.setTimeout(() => setShareState(""), 1600);
    } catch {
      setShareState("");
    }
  };
  return (
    <article className={`community-post ${post.accepted ? "accepted" : ""} ${post.isOriginal ? "original" : ""}`} id={`post-${post.id}`}>
      {post.accepted && <div className="accepted-banner"><span><CircleCheck size={14} strokeWidth={2.2} aria-hidden="true" /></span><b>Accepted solution</b><small>Selected by the topic author</small></div>}
      <aside className="community-post-author">
        <button className="community-member-link" onClick={() => onMember(post.author)} aria-label={`View ${post.author.name}'s profile`}>
          <Avatar member={post.author} size="large" />
          <b>{post.author.name}</b>
          <span>@{post.author.handle}</span>
        </button>
        <small className={`member-role ${post.author.role}`}>{role}</small>
        {post.author.location && <small>{post.author.location}</small>}
        <dl><div><dt>Reputation</dt><dd>{formatCount(post.author.reputation)}</dd></div><div><dt>Post</dt><dd>#{index + 1}</dd></div></dl>
      </aside>
      <div className="community-post-content">
        <header>
          <span>{post.isOriginal ? "Original topic" : `Reply #${index}`} · {relativeTime(post.createdAt)}</span>
          {post.updatedAt && post.updatedAt !== post.createdAt && <small>edited {relativeTime(post.updatedAt)}</small>}
          <div className="community-post-top-actions">
            <button onClick={sharePost} title="Share this post" aria-label="Share this post">{shareState || "⌯"}</button>
            <button className={thread.bookmarked ? "active" : ""} onClick={onBookmark} title="Bookmark this discussion" aria-label="Bookmark this discussion">{thread.bookmarked ? "★" : "☆"}</button>
            <a href={`#post-${post.id}`} aria-label={`Permalink to post ${index + 1}`}>#{index + 1}</a>
          </div>
        </header>
        {parent && <button className="community-reply-context" onClick={() => document.getElementById(`post-${parent.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}>↳ Replying to {parent.author.name}: <span>{parent.body.slice(0, 110)}</span></button>}
        <div className="community-post-body"><ForumFormattedText body={post.body} /></div>
        <footer>
          <button className="community-report-action" onClick={() => onReport({ type: post.isOriginal ? "thread" : "post", id: post.isOriginal ? thread.id : post.id, label: post.isOriginal ? "this topic" : `reply #${index}` })}>Report</button>
          <div className="community-post-actions">
            <ReactionBar threadId={thread.id} post={post} onUpdate={onReactionUpdate} />
            {!thread.locked && <button onClick={() => onQuote(post)}>＋ Quote</button>}
            {!thread.locked && <button onClick={() => onReply(post)}>↩ Reply</button>}
            {canAccept && !post.isOriginal && <button className={post.accepted ? "accepted-action" : ""} onClick={() => onAccept(post.id)}>{post.accepted ? "Remove solution" : "Accept solution"}</button>}
          </div>
        </footer>
      </div>
    </article>
  );
}

function ThreadView({
  threadId,
  onBack,
  onThreadUpdated,
  onReport,
  designLab = false,
}: {
  threadId: string;
  onBack: () => void;
  onThreadUpdated: (thread: ThreadSummary) => void;
  onReport: (target: ReportTarget) => void;
  designLab?: boolean;
}) {
  const [thread, setThread] = useState<ThreadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reply, setReply] = useState("");
  const [replyParent, setReplyParent] = useState<ForumPost | null>(null);
  const [replying, setReplying] = useState(false);
  const [replyError, setReplyError] = useState("");
  const [replyPreview, setReplyPreview] = useState(false);
  const [actionBusy, setActionBusy] = useState("");
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(threadId);
      const endpoint = isUuid ? `/threads/${encodeURIComponent(threadId)}` : `/threads/by-number/${encodeURIComponent(threadId)}`;
      const payload = await api<unknown>(endpoint);
      const detail = normalizeThreadDetail(payload);
      setThread(detail);
      const canonicalPath = threadPath(detail, designLab);
      if (window.location.pathname.replace(/\/$/, "") !== canonicalPath.replace(/\/$/, "")) {
        window.history.replaceState({ threadId: detail.id }, "", canonicalPath);
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The discussion could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [designLab, threadId]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const updatePost = (postId: string, reactions: ReactionState, myReaction?: ReactionKind) => {
    setThread(current => {
      if (!current) return current;
      if (current.originalPost.id === postId) return { ...current, originalPost: { ...current.originalPost, reactions, myReaction } };
      return { ...current, posts: current.posts.map(post => post.id === postId ? { ...post, reactions, myReaction } : post) };
    });
  };

  const quotePost = (post: ForumPost) => {
    setReplyParent(post);
    const quoted = post.body.split("\n").slice(0, 8).map(line => `> ${line}`).join("\n");
    setReply(current => `${current ? `${current}\n\n` : ""}> ${post.author.name} wrote:\n${quoted}\n\n`);
    window.setTimeout(() => {
      composerRef.current?.focus();
      composerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 0);
  };

  const replyToPost = (post: ForumPost) => {
    setReplyParent(post);
    window.setTimeout(() => {
      composerRef.current?.focus();
      composerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 0);
  };

  const applyReplyFormat = (format: ReplyFormat) => {
    const input = composerRef.current;
    const start = input?.selectionStart ?? reply.length;
    const end = input?.selectionEnd ?? reply.length;
    const selected = reply.slice(start, end);
    const fallback = selected || {
      bold: "bold text",
      italic: "italic text",
      underline: "underlined text",
      strike: "strikethrough text",
      heading: "Section heading",
      bullets: "list item",
      numbered: "list item",
      quote: "quoted text",
      code: "code or configuration",
      link: "link text",
      image: "image description",
      smile: "",
    }[format];
    let replacement = fallback;
    let selectionOffset = 0;
    if (format === "bold") { replacement = `**${fallback}**`; selectionOffset = 2; }
    if (format === "italic") { replacement = `*${fallback}*`; selectionOffset = 1; }
    if (format === "underline") { replacement = `<u>${fallback}</u>`; selectionOffset = 3; }
    if (format === "strike") { replacement = `~~${fallback}~~`; selectionOffset = 2; }
    if (format === "heading") replacement = `### ${fallback}`;
    if (format === "bullets") replacement = fallback.split("\n").map(line => `- ${line}`).join("\n");
    if (format === "numbered") replacement = fallback.split("\n").map((line, index) => `${index + 1}. ${line}`).join("\n");
    if (format === "quote") replacement = fallback.split("\n").map(line => `> ${line}`).join("\n");
    if (format === "code") { replacement = `\`\`\`\n${fallback}\n\`\`\``; selectionOffset = 4; }
    if (format === "link") { replacement = `[${fallback}](https://)`; selectionOffset = 1; }
    if (format === "image") { replacement = `![${fallback}](https://)`; selectionOffset = 2; }
    if (format === "smile") replacement = `${selected}${selected ? " " : ""}🙂`;
    const nextReply = `${reply.slice(0, start)}${replacement}${reply.slice(end)}`;
    setReply(nextReply);
    window.setTimeout(() => {
      const composer = composerRef.current;
      if (!composer) return;
      composer.focus();
      const selectionStart = start + selectionOffset;
      composer.setSelectionRange(selectionStart, selected ? selectionStart + selected.length : start + replacement.length - selectionOffset);
    }, 0);
  };

  const submitReply = async (event: FormEvent) => {
    event.preventDefault();
    if (!thread || reply.trim().length < 2) return;
    setReplying(true);
    setReplyError("");
    try {
      const payload = await api<unknown>(`/threads/${encodeURIComponent(thread.id)}/posts`, { method: "POST", body: JSON.stringify({ body: reply.trim(), parentId: replyParent?.id ?? null }) });
      const created = asRecord(unpack(payload));
      const post = normalizePost(created.post ?? created);
      setThread(current => current ? { ...current, posts: [...current.posts, post], replyCount: current.replyCount + 1, lastActivityAt: post.createdAt || new Date().toISOString() } : current);
      setReply("");
      setReplyParent(null);
      window.setTimeout(() => document.getElementById(`post-${post.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 0);
    } catch (requestError) {
      setReplyError(requestError instanceof Error ? requestError.message : "Your reply could not be posted.");
    } finally {
      setReplying(false);
    }
  };

  const toggleThreadFlag = async (flag: "bookmark" | "follow") => {
    if (!thread || actionBusy) return;
    const property = flag === "bookmark" ? "bookmarked" : "followed";
    const nextValue = !thread[property];
    setActionBusy(flag);
    setThread(current => current ? { ...current, [property]: nextValue } : current);
    try {
      await api(`/threads/${encodeURIComponent(thread.id)}/${flag}`, { method: "PUT", body: JSON.stringify({ active: nextValue }) });
      onThreadUpdated({ ...thread, [property]: nextValue });
    } catch {
      setThread(current => current ? { ...current, [property]: !nextValue } : current);
    } finally {
      setActionBusy("");
    }
  };

  const accept = async (postId: string) => {
    if (!thread || actionBusy) return;
    const selected = thread.posts.find(post => post.id === postId);
    const nextId = selected?.accepted ? null : postId;
    setActionBusy("accept");
    try {
      await api(`/threads/${encodeURIComponent(thread.id)}/accepted-answer`, { method: "PUT", body: JSON.stringify({ postId: nextId }) });
      setThread(current => current ? { ...current, solved: Boolean(nextId), posts: current.posts.map(post => ({ ...post, accepted: post.id === nextId })) } : current);
    } finally {
      setActionBusy("");
    }
  };

  if (loading) return <div className="community-thread-loading"><span /><span /><span /></div>;
  if (error || !thread) return <div className="community-state-panel thread-error" role="alert"><span>!</span><h3>This discussion did not load.</h3><p>{error || "It may have been removed."}</p><div><button className="secondary-button" onClick={onBack}>Back to community</button><button className="primary-button" onClick={load}>Try again</button></div></div>;

  const category = categoryMeta(thread.categorySlug);
  const allPosts = [thread.originalPost, ...thread.posts].sort((a, b) => {
    if (a.isOriginal) return -1;
    if (b.isOriginal) return 1;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
  const isMarketplace = thread.topicType === "deal" || thread.topicType === "sale" || ["promotions", "online-deals", "for-sale", "wanted"].includes(thread.categorySlug);
  const canAccept = thread.topicType === "question" && (thread.author.id === LOCAL_MEMBER.id || LOCAL_MEMBER.role === "admin");

  return (
    <div className="community-thread-view">
      <button className="community-back-button" onClick={onBack}>← All community discussions</button>
      <header className="community-thread-header" style={{ "--category-accent": category.accent } as React.CSSProperties}>
        <div>
          <div className="community-thread-title-line"><span className="community-thread-category">{thread.categoryName || category.name}</span><ThreadBadges thread={thread} /></div>
          <h1 title={thread.title}>{thread.title}</h1>
          <p>Started by <button onClick={() => setSelectedMember(thread.author)}>{thread.author.name}</button> · {relativeTime(thread.createdAt)}</p>
          {thread.tags.length > 0 && <div className="community-thread-tags">{thread.tags.map(tag => <span key={tag}>#{tag}</span>)}</div>}
        </div>
        <aside>
          <div><b>{formatCount(thread.replyCount)}</b><span>replies</span></div>
          <div><b>{formatCount(thread.viewCount)}</b><span>views</span></div>
          <div><b>{formatCount(thread.reactionCount)}</b><span>reactions</span></div>
          <button className={thread.bookmarked ? "active" : ""} onClick={() => toggleThreadFlag("bookmark")} disabled={Boolean(actionBusy)} aria-pressed={thread.bookmarked} aria-label={thread.bookmarked ? "Remove bookmark" : "Bookmark discussion"} title={thread.bookmarked ? "Remove bookmark" : "Bookmark discussion"}><Bookmark size={18} strokeWidth={2} fill={thread.bookmarked ? "currentColor" : "none"} aria-hidden="true" /></button>
          <button className={thread.followed ? "active" : ""} onClick={() => toggleThreadFlag("follow")} disabled={Boolean(actionBusy)} aria-pressed={thread.followed} aria-label={thread.followed ? "Stop watching topic" : "Watch topic"} title={thread.followed ? "Stop watching topic" : "Watch topic"}><Eye size={19} strokeWidth={2} aria-hidden="true" /></button>
        </aside>
      </header>
      {isMarketplace && <div className="community-thread-notice marketplace"><b>Marketplace caution</b><span>Solar4U does not verify sellers, hold funds or guarantee equipment. Inspect high-energy equipment, confirm ownership and use reversible payment methods.</span></div>}
      <section className="community-post-stack" aria-label="Discussion posts">
        {allPosts.map((post, index) => <PostCard key={post.id} thread={thread} post={post} parent={post.parentId ? allPosts.find(candidate => candidate.id === post.parentId) : undefined} index={index} canAccept={canAccept} onQuote={quotePost} onReply={replyToPost} onReport={onReport} onAccept={accept} onBookmark={() => toggleThreadFlag("bookmark")} onReactionUpdate={updatePost} onMember={setSelectedMember} />)}
      </section>
      <section className="community-reply-panel">
        {thread.locked ? <p>A moderator has closed this topic to new replies. Existing information remains readable.</p> : (
          <form onSubmit={submitReply}>
            {replyParent && <div className="community-replying-to"><span>Replying to <b>{replyParent.author.name}</b></span><button type="button" onClick={() => setReplyParent(null)}>Cancel reply target</button></div>}
            <div className="community-reply-editor">
              <div className="community-reply-toolbar" role="toolbar" aria-label="Reply formatting">
                {replyFormattingTools.map(({ id, label, Icon }) => (
                  <button type="button" onMouseDown={event => event.preventDefault()} onClick={() => applyReplyFormat(id)} title={label} aria-label={label} key={id}><Icon size={17} strokeWidth={2} aria-hidden="true" /></button>
                ))}
                <span aria-hidden="true" />
                <button className={replyPreview ? "active" : ""} type="button" onClick={() => setReplyPreview(current => !current)} aria-pressed={replyPreview} title="Preview reply" aria-label="Preview reply"><Eye size={17} strokeWidth={2} aria-hidden="true" /></button>
              </div>
              {replyPreview ? <div className="community-reply-preview" aria-label="Reply preview">{reply.trim() ? <ForumFormattedText body={reply} /> : <p>Your formatted reply will appear here.</p>}</div> : <textarea aria-label="Write your reply" id="community-reply" ref={composerRef} value={reply} onChange={event => setReply(event.target.value)} rows={5} maxLength={12_000} placeholder="Write your reply…" />}
            </div>
            <div className="community-reply-footer"><small>Replying as <b>{LOCAL_MEMBER.handle}</b> · {reply.length.toLocaleString()}/12,000</small><button className="primary-button" disabled={replying || reply.trim().length < 2}>{replying ? "Posting…" : "Post reply"}</button></div>
            {replyError && <p className="community-form-error" role="alert">{replyError}</p>}
          </form>
        )}
      </section>
      <MemberProfileDialog member={selectedMember} onClose={() => setSelectedMember(null)} onOpenThread={target => { setSelectedMember(null); if (target.id !== thread.id) window.location.href = threadPath(target, designLab); }} />
    </div>
  );
}

function ModerationQueue({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [reports, setReports] = useState<ModerationReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const payload = await api<unknown>("/moderation/reports");
      const data = unpack(payload);
      const container = asRecord(data);
      setReports(asArray(container.reports ?? data).map(normalizeReport));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The moderation queue could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const loadTimer = window.setTimeout(() => { void load(); }, 0);
    const onKey = (event: globalThis.KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    window.setTimeout(() => ref.current?.querySelector<HTMLButtonElement>("button")?.focus(), 0);
    return () => {
      window.clearTimeout(loadTimer);
      document.removeEventListener("keydown", onKey);
    };
  }, [load, onClose, open]);

  if (!open) return null;

  const resolve = async (report: ModerationReport, status: "resolved" | "dismissed") => {
    setBusy(report.id);
    try {
      await api(`/moderation/reports/${encodeURIComponent(report.id)}`, { method: "PATCH", body: JSON.stringify({ status, resolutionNote: status === "resolved" ? "Reviewed by local administrator." : "No action required after local review." }) });
      setReports(current => current.map(item => item.id === report.id ? { ...item, status } : item));
    } finally {
      setBusy("");
    }
  };

  const openReports = reports.filter(report => report.status === "open");
  return (
    <div className="community-dialog-backdrop moderation-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="community-dialog community-moderation-dialog" role="dialog" aria-modal="true" aria-labelledby="moderation-title" ref={ref}>
        <header><div><span className="eyebrow">LOCAL ADMINISTRATION</span><h2 id="moderation-title">Moderation queue</h2><p>Reports preserve context; resolving one does not silently delete member content.</p></div><button className="community-icon-button" onClick={onClose} aria-label="Close moderation queue">×</button></header>
        <div className="moderation-summary"><span><b>{openReports.length}</b> open</span><span><b>{reports.filter(report => report.status === "resolved").length}</b> resolved</span><button onClick={load}>Refresh queue</button></div>
        {loading ? <div className="community-loading-list"><span /><span /><span /></div> : error ? <div className="community-state-panel" role="alert"><span>!</span><h3>Queue unavailable</h3><p>{error}</p><button className="secondary-button" onClick={load}>Try again</button></div> : !reports.length ? <div className="community-state-panel"><span>✓</span><h3>No reports in the queue.</h3><p>The local community record is clear.</p></div> : (
          <div className="moderation-list">
            {reports.map(report => <article className={report.status !== "open" ? "closed" : ""} key={report.id}>
              <header><span>{report.targetType}</span><b>{report.status}</b></header>
              <h3>{report.targetTitle || `${report.targetType} ${report.targetId.slice(0, 8)}`}</h3>
              <p><b>{report.reason.replace(/_/g, " ")}</b>{report.details ? ` — ${report.details}` : ""}</p>
              <small>Reported {relativeTime(report.createdAt)}{report.reporter ? ` by ${report.reporter}` : ""}</small>
              {report.status === "open" && <footer><button disabled={busy === report.id} onClick={() => resolve(report, "dismissed")}>Dismiss</button><button disabled={busy === report.id} onClick={() => resolve(report, "resolved")}>Mark reviewed</button></footer>}
            </article>)}
          </div>
        )}
      </div>
    </div>
  );
}

function CommunityDesignLab({
  theme,
  onTheme,
  layout,
  onLayout,
}: {
  theme: CommunityTestTheme;
  onTheme: (theme: CommunityTestTheme) => void;
  layout: CommunityTestLayout;
  onLayout: (layout: CommunityTestLayout) => void;
}) {
  return (
    <section className="community-design-picker" aria-labelledby="community-design-picker-title">
      <div>
        <span>COLOR STUDY · ORIGINAL FORUM UNAFFECTED</span>
        <h1 id="community-design-picker-title">Choose a Solar4U direction.</h1>
        <p>Compare three focused palettes and three layouts on the same working forum. Day and night mode now live beside your profile in the site header.</p>
      </div>
      <div className="community-design-control-panel">
        <div className="community-design-options" role="radiogroup" aria-label="Community test color direction">
          {communityTestThemes.map(option => (
            <button
              className={theme === option.id ? "active" : ""}
              onClick={() => onTheme(option.id)}
              role="radio"
              aria-checked={theme === option.id}
              key={option.id}
            >
              <span className="community-theme-swatches" aria-hidden="true">{option.colors.map(color => <i style={{ background: color }} key={color} />)}</span>
              <b>{option.name}</b>
              <small>{option.note}</small>
            </button>
          ))}
        </div>
        <div className="community-design-switches">
          <div className="community-layout-switch">
            <span>AWARD-INSPIRED LAYOUT</span>
            <div role="radiogroup" aria-label="Community test layout">
              {communityTestLayouts.map(option => <button className={layout === option.id ? "active" : ""} onClick={() => onLayout(option.id)} role="radio" aria-checked={layout === option.id} title={option.note} key={option.id}>{option.name}</button>)}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function CommunityPage({
  initialThreadId = "",
  designLab = false,
  testMode = "light",
}: {
  initialThreadId?: string;
  designLab?: boolean;
  testMode?: CommunityTestMode;
}) {
  const [categories, setCategories] = useState<ForumCategory[]>(categoryBlueprints);
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [sort, setSort] = useState<SortMode>("latest");
  const [timeRange, setTimeRange] = useState<TimeRange>("all");
  const [category, setCategory] = useState("");
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [, setLoadingForums] = useState(true);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [forumError, setForumError] = useState("");
  const [threadError, setThreadError] = useState("");
  const [selectedThreadId, setSelectedThreadId] = useState(initialThreadId);
  const [composerOpen, setComposerOpen] = useState(false);
  const [moderationOpen, setModerationOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [testTheme, setTestTheme] = useState<CommunityTestTheme>("editorial-taupe");
  const [testLayout, setTestLayout] = useState<CommunityTestLayout>("mosaic");
  const searchRef = useRef<HTMLInputElement>(null);

  const loadForums = useCallback(async () => {
    setLoadingForums(true);
    setForumError("");
    try {
      const payload = await api<unknown>("/forums");
      const data = unpack(payload);
      const container = asRecord(data);
      const incoming = asArray(container.categories ?? data).map(normalizeCategory);
      const merged = categoryBlueprints.map(blueprint => {
        const actual = incoming.find(item => item.slug === blueprint.slug || slugify(item.name) === slugify(blueprint.name));
        return actual ? { ...blueprint, threadCount: actual.threadCount, postCount: actual.postCount, latest: actual.latest } : blueprint;
      });
      setCategories(merged);
    } catch (requestError) {
      setForumError(requestError instanceof Error ? requestError.message : "The forum directory could not be loaded.");
      setCategories(categoryBlueprints);
    } finally {
      setLoadingForums(false);
    }
  }, []);

  const loadThreads = useCallback(async () => {
    setLoadingThreads(true);
    setThreadError("");
    const parameters = new URLSearchParams({ sort, period: timeRange });
    if (category) parameters.set("category", category);
    if (query) parameters.set("q", query);
    try {
      const payload = await api<unknown>(`/threads?${parameters.toString()}`);
      const data = unpack(payload);
      const container = asRecord(data);
      setThreads(asArray(container.threads ?? data).map(normalizeThread));
    } catch (requestError) {
      setThreadError(requestError instanceof Error ? requestError.message : "The discussion feed could not be loaded.");
      setThreads([]);
    } finally {
      setLoadingThreads(false);
    }
  }, [category, query, sort, timeRange]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadForums(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadForums]);
  useEffect(() => {
    const timer = window.setTimeout(() => { void loadThreads(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadThreads]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(queryInput.trim());
      setPage(1);
    }, 320);
    return () => window.clearTimeout(timer);
  }, [queryInput]);

  useEffect(() => {
    const syncFromUrl = () => {
      const parameters = new URLSearchParams(window.location.search);
      const isThreadPermalink = window.location.pathname.startsWith("/threads/");
      const id = parameters.get("thread") || (isThreadPermalink ? threadReferenceFromPath(window.location.pathname) || initialThreadId : "");
      setSelectedThreadId(id);
      setCategory(parameters.get("category") || "");
      setPage(1);
    };
    syncFromUrl();
    window.addEventListener("popstate", syncFromUrl);
    return () => window.removeEventListener("popstate", syncFromUrl);
  }, [initialThreadId]);

  const openThread = (thread: ThreadSummary) => {
    setSelectedThreadId(thread.id);
    window.history.pushState({ threadId: thread.id }, "", threadPath(thread, designLab));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const closeThread = () => {
    setSelectedThreadId("");
    const root = designLab ? "/community-test" : "/community";
    const destination = category ? `${root}?category=${encodeURIComponent(category)}` : root;
    window.history.pushState({}, "", destination);
    window.scrollTo({ top: 0, behavior: "smooth" });
    void loadThreads();
  };

  const chooseCategory = (slug: string) => {
    setPage(1);
    if (slug === "__unanswered__") {
      setCategory("");
      setSort("unanswered");
    } else {
      setCategory(slug);
      setSort("latest");
    }
    setSelectedThreadId("");
    const url = new URL(window.location.href);
    url.searchParams.delete("thread");
    if (slug && slug !== "__unanswered__") url.searchParams.set("category", slug);
    else url.searchParams.delete("category");
    window.history.pushState({ category: slug }, "", url);
    window.setTimeout(() => document.getElementById("community-discussions")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  };

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    setPage(1);
    setQuery(queryInput.trim());
    window.setTimeout(() => document.getElementById("community-discussions")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  };

  const handleSearchKey = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setQueryInput("");
      setQuery("");
      setPage(1);
      searchRef.current?.blur();
    }
  };

  const threadUpdated = (updated: ThreadSummary) => {
    setThreads(current => current.map(thread => thread.id === updated.id ? { ...thread, ...updated } : thread));
  };

  const selectedCategory = categories.find(item => item.slug === category);
  const pageSize = category ? 10 : 8;
  const pageCount = Math.max(1, Math.ceil(threads.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visibleThreads = threads.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  if (selectedThreadId) {
    return (
      <main className={`community-page community-thread-page ${designLab ? `community-design-lab theme-${testTheme} mode-${testMode} layout-${testLayout}` : ""}`}>
        {designLab && <CommunityDesignLab theme={testTheme} onTheme={setTestTheme} layout={testLayout} onLayout={setTestLayout} />}
        <ThreadView threadId={selectedThreadId} onBack={closeThread} onThreadUpdated={threadUpdated} onReport={setReportTarget} designLab={designLab} />
        <ReportDialog target={reportTarget} onClose={() => setReportTarget(null)} />
      </main>
    );
  }

  return (
    <main className={`community-page ${designLab ? `community-design-lab theme-${testTheme} mode-${testMode} layout-${testLayout}` : ""}`}>
      {designLab && <CommunityDesignLab theme={testTheme} onTheme={setTestTheme} layout={testLayout} onLayout={setTestLayout} />}
      {!selectedCategory && <section className="community-hero">
        <div>
          <span className="eyebrow">SOLAR4U COMMUNITY</span>
          <h1>Technical solar discussions.</h1>
          <p>Ask specific questions, compare equipment and leave field results that another builder can verify.</p>
        </div>
        <div className="community-hero-actions"><button className="primary-button" onClick={() => setComposerOpen(true)}>+ Post new topic</button></div>
      </section>}

      <nav className="community-utility-bar" aria-label="Forum navigation">
        <div><button className={!selectedCategory ? "active" : ""} onClick={() => chooseCategory("")}>Forum index</button>{selectedCategory && <><span>/</span><b>{selectedCategory.name}</b></>}</div>
        <div><button onClick={() => chooseCategory("__unanswered__")}>Unanswered</button><button onClick={() => chooseCategory("online-deals")}>Online deals</button><button onClick={() => setModerationOpen(true)}>Moderation</button><button className="primary-button" onClick={() => setComposerOpen(true)}>+ New topic</button></div>
      </nav>

      {forumError && <div className="community-api-notice" role="status"><span>Directory counts are temporarily unavailable. The boards remain accessible.</span><button onClick={loadForums}>Retry</button></div>}
      {!selectedCategory && <ForumDirectory categories={categories} onChoose={chooseCategory} />}
      <section className={`community-feed-shell ${selectedCategory ? "category-view" : "recent-view"}`} id="community-discussions">
        <div className="community-feed-main">
          <div className="community-feed-heading">
            <div>
              <span className="eyebrow">{selectedCategory ? "CATEGORY THREADS" : "LATEST ACTIVITY"}</span>
              <h2>{selectedCategory ? selectedCategory.name : "Recent community posts"}</h2>
              <p>{selectedCategory ? selectedCategory.description : "The newest questions, field reports, builds and market finds from every category."}</p>
            </div>
            <button className="primary-button" onClick={() => setComposerOpen(true)}>+ New topic</button>
          </div>
          <form className="community-searchbar" onSubmit={submitSearch}>
            <label><span>⌕</span><input ref={searchRef} value={queryInput} onChange={event => setQueryInput(event.target.value)} onKeyDown={handleSearchKey} aria-label="Search community discussions" placeholder="Search models, errors, code topics or member notes" /></label>
            <select value={category} onChange={event => chooseCategory(event.target.value)} aria-label="Filter by forum category"><option value="">All categories</option>{categories.map(item => <option value={item.slug} key={item.slug}>{item.name}</option>)}</select>
            {(category || queryInput) && <button type="button" className="community-clear-filter" onClick={() => { chooseCategory(""); setQueryInput(""); setQuery(""); }}>Clear</button>}
          </form>
          <div className="community-feed-controls">
            <div className="community-feed-tabs" role="tablist" aria-label="Discussion sorting">
              {([
                ["latest", "Last commented"],
                ["top", "Top"],
                ["unanswered", "Unanswered"],
                ["following", "Following"],
                ["bookmarked", "Bookmarked"],
              ] as Array<[SortMode, string]>).map(([value, label]) => <button role="tab" aria-selected={sort === value} className={sort === value ? "active" : ""} onClick={() => { setSort(value); setPage(1); }} key={value}>{label}</button>)}
            </div>
            <label className="community-period-filter"><span>Activity</span><select value={timeRange} onChange={event => { setTimeRange(event.target.value as TimeRange); setPage(1); }} aria-label="Filter discussions by recent activity"><option value="1d">1 day</option><option value="7d">7 days</option><option value="30d">30 days</option><option value="6m">6 months</option><option value="1y">1 year</option><option value="all">All time</option></select></label>
          </div>
          <ThreadList threads={visibleThreads} loading={loadingThreads} error={threadError} onRetry={loadThreads} onOpen={openThread} detailed={Boolean(selectedCategory)} />
          {!loadingThreads && !threadError && threads.length > 0 && (
            <nav className="community-pagination" aria-label="Discussion pages">
              <span>Showing <b>{(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, threads.length)}</b> of <b>{threads.length}</b> discussions</span>
              <div>
                <button disabled={currentPage === 1} onClick={() => setPage(value => Math.max(1, value - 1))}>‹ Previous</button>
                {Array.from({ length: pageCount }, (_, index) => index + 1).slice(0, 5).map(value => <button className={value === currentPage ? "active" : ""} onClick={() => setPage(value)} key={value}>{value}</button>)}
                <button disabled={currentPage === pageCount} onClick={() => setPage(value => Math.min(pageCount, value + 1))}>Next ›</button>
              </div>
            </nav>
          )}
        </div>
      </section>

      <ComposerDialog open={composerOpen} categories={categories} initialCategory={category} onClose={() => setComposerOpen(false)} onCreated={thread => { setComposerOpen(false); setThreads(current => [thread, ...current]); openThread(thread); }} />
      <ModerationQueue open={moderationOpen} onClose={() => setModerationOpen(false)} />
      <ReportDialog target={reportTarget} onClose={() => setReportTarget(null)} />
    </main>
  );
}
