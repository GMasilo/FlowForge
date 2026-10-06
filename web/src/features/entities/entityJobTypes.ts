export type EntityJob = {
  id: string; entity_id: string; name: string; action: 'csv_s3' | 'cleanup'; enabled: boolean
  daily_time: string; timezone: string; destination: string | null; columns: string[]
  stale_days: number; filter_key: string | null; filter_value: string | null
  next_run_at: string; created_by: string; created_at: string
}
export type EntityJobRun = {
  id: string; job_id: string; scheduled_at: string; started_at: string; finished_at: string | null
  status: 'running' | 'succeeded' | 'failed'; row_count: number | null; object_key: string | null; error: string | null
}
