import api from './api'

export const CRM_STATUSES = [
  'new',
  'contacted',
  'interested',
  'converted',
  'lost',
]

export const CRM_SOURCES = [
  'website',
  'phone',
  'whatsapp',
  'referral',
  'social',
  'other',
]

export async function fetchCrmStats() {
  const { data } = await api.get('/crm/stats')
  return data
}

export async function fetchLeads(params = {}) {
  const { data } = await api.get('/crm/leads', { params })
  return data.leads
}

export async function createLead(payload) {
  const { data } = await api.post('/crm/leads', payload)
  return data.lead
}

export async function updateLead(id, payload) {
  const { data } = await api.patch(`/crm/leads/${id}`, payload)
  return data.lead || data
}

export async function deleteLead(id) {
  const { data } = await api.delete(`/crm/leads/${id}`)
  return data
}
