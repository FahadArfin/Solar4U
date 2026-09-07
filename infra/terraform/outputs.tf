output "artifact_repository" { value = google_artifact_registry_repository.containers.id }
output "database_connection_name" { value = google_sql_database_instance.postgres.connection_name }
output "runtime_service_account" { value = google_service_account.runtime.email }
output "object_bucket" { value = google_storage_bucket.objects.name }
