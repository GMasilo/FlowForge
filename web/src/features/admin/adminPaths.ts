export function instanceAdminPath(instanceId: string, page?: string) {
  const base = `/instances/${instanceId}/admin`
  return page ? `${base}/${page}` : base
}
