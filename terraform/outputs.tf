output "d1_database_id" {
  value       = cloudflare_d1_database.task_app.id
  description = "wrangler.toml の database_id に貼り付ける"
}

output "worker_name" {
  value = cloudflare_workers_script.task_app.name
}

output "preview_d1_database_id" {
  value       = cloudflare_d1_database.task_app_preview.id
  description = "wrangler.toml の [[env.preview.d1_databases]] database_id に貼り付ける"
}

output "preview_worker_name" {
  value = cloudflare_workers_script.task_app_preview.name
}
