locals {
  prefix = "solar4u-${var.environment}"
  services = ["run.googleapis.com","sqladmin.googleapis.com","artifactregistry.googleapis.com","redis.googleapis.com","pubsub.googleapis.com","cloudscheduler.googleapis.com","secretmanager.googleapis.com","monitoring.googleapis.com"]
}

resource "google_project_service" "apis" {
  for_each = toset(local.services)
  service  = each.value
  disable_on_destroy = false
}

resource "google_artifact_registry_repository" "containers" {
  depends_on    = [google_project_service.apis]
  location      = var.region
  repository_id = local.prefix
  format        = "DOCKER"
}

resource "google_service_account" "runtime" {
  account_id   = "${local.prefix}-runtime"
  display_name = "Solar4U ${var.environment} runtime"
}

resource "google_sql_database_instance" "postgres" {
  depends_on       = [google_project_service.apis]
  name             = "${local.prefix}-postgres"
  database_version = "POSTGRES_17"
  region           = var.region
  deletion_protection = var.environment == "production"
  settings {
    tier              = var.database_tier
    availability_type = var.environment == "production" ? "REGIONAL" : "ZONAL"
    backup_configuration {
      enabled                        = true
      point_in_time_recovery_enabled = true
    }
    ip_configuration { ipv4_enabled = true }
  }
}

resource "google_sql_database" "app" {
  name     = "solar4u"
  instance = google_sql_database_instance.postgres.name
}

resource "google_storage_bucket" "objects" {
  name                        = "${var.project_id}-${local.prefix}-objects"
  location                    = var.region
  uniform_bucket_level_access = true
  versioning { enabled = true }
  lifecycle_rule {
    condition { age = 90; matches_prefix = ["exports/"] }
    action { type = "Delete" }
  }
}

resource "google_pubsub_topic" "jobs" { name = "${local.prefix}-jobs" }
resource "google_pubsub_topic" "dead_letter" { name = "${local.prefix}-dead-letter" }

resource "google_redis_instance" "cache" {
  depends_on     = [google_project_service.apis]
  name           = "${local.prefix}-cache"
  tier           = "BASIC"
  memory_size_gb = 1
  region         = var.region
  redis_version  = "REDIS_7_2"
}

resource "google_secret_manager_secret" "runtime" {
  for_each  = toset(["database-url","google-solar-api-key","nrel-api-key","auth-secret","google-client-id","google-client-secret"])
  secret_id = "${local.prefix}-${each.value}"
  replication { auto {} }
}

resource "google_cloud_scheduler_job" "price_daily" {
  depends_on  = [google_project_service.apis]
  name        = "${local.prefix}-price-daily"
  description = "Runs Solar4U retailer collection at 9 AM Eastern"
  schedule    = "0 9 * * *"
  time_zone   = "America/New_York"
  paused      = true
  http_target {
    uri         = "https://${var.region}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${var.project_id}/jobs/${local.prefix}-price-worker:run"
    http_method = "POST"
    oauth_token { service_account_email = google_service_account.runtime.email }
  }
}
