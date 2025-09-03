<template>
  <div class="container">
    <h1>Документы (демо ретривера)</h1>

    <div class="grid">
      <div class="field">
        <label for="source-id">source_id</label>
        <input id="source-id" v-model="sourceId" placeholder="candidate_7c016178" />
      </div>
      <div class="field">
        <label for="source-type">source_type</label>
        <select id="source-type" v-model="sourceType">
          <option value="resume">resume</option>
          <option value="dialogue">dialogue</option>
          <option value="vacancy">vacancy</option>
        </select>
      </div>
      <div class="field">
        <label for="doc-name">document_name</label>
        <input id="doc-name" v-model="documentName" placeholder="resume_ivanov.txt" />
      </div>
    </div>

    <label for="doc-text">Содержимое документа</label>
    <textarea
      id="doc-text"
      v-model="content"
      rows="10"
      placeholder="Текст документа..."
    />

    <div class="actions">
      <button :disabled="loading" @click="uploadDocument">{{ loading ? 'Загрузка...' : 'Загрузить документ' }}</button>
      <button class="secondary" :disabled="loading" @click="clearForm">Очистить форму</button>
    </div>

    <div v-if="error" class="error">{{ error }}</div>

    <div v-if="uploadResult" class="result">
      <h2>Загружено</h2>
      <pre>{{ prettyUpload }}</pre>
    </div>

    <hr />

    <h2>Гибридный поиск</h2>
    <div class="search-col">
      <div class="field">
        <label for="query-text">query_text (опционально)</label>
        <input id="query-text" v-model="queryText" placeholder="опыт React с RTK" />
      </div>

      <div class="filters">
        <div class="filters-header">
          <span>Фильтры</span>
          <button class="secondary" @click="addFilter">+ Добавить фильтр</button>
        </div>
        <div v-for="(f, idx) in filters" :key="idx" class="filter-row">
          <input v-model="f.field" placeholder="structured_data.total_experience_months" />
          <select v-model="f.operator">
            <option value="$eq">$eq</option>
            <option value="$gt">$gt</option>
            <option value="$gte">$gte</option>
            <option value="$lt">$lt</option>
            <option value="$lte">$lte</option>
            <option value="$ne">$ne</option>
            <option value="$in">$in</option>
            <option value="$nin">$nin</option>
          </select>
          <input v-model="f.value" placeholder="36" />
          <button class="secondary" @click="removeFilter(idx)">Удалить</button>
        </div>
      </div>

      <div class="actions">
        <button :disabled="loadingSearch" @click="runQuery">{{ loadingSearch ? 'Поиск...' : 'Искать' }}</button>
        <button class="danger" @click="resetDb" :disabled="resetting">Очистить базу</button>
      </div>
    </div>

    <div v-if="searchError" class="error">{{ searchError }}</div>
    <div v-if="searchResult" class="result">
      <h3>Результаты</h3>
      <pre>{{ prettySearch }}</pre>
    </div>
  </div>
  
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

// Upload document (API-first)
const sourceId = ref('candidate_7c016178')
const sourceType = ref<'resume' | 'dialogue' | 'vacancy'>('resume')
const documentName = ref('document.txt')
const content = ref('')
const loading = ref(false)
const error = ref<string | null>(null)
const uploadResult = ref<Record<string, unknown> | null>(null)
const prettyUpload = computed(() => (uploadResult.value ? JSON.stringify(uploadResult.value, null, 2) : ''))

function clearForm() {
  error.value = null
  uploadResult.value = null
  content.value = ''
}

async function uploadDocument() {
  error.value = null
  uploadResult.value = null
  const text = content.value.trim()
  if (!sourceId.value.trim() || !documentName.value.trim() || !text) {
    error.value = 'Заполните source_id, document_name и контент.'
    return
  }
  try {
    loading.value = true
    const resp = await fetch('/api/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source_id: sourceId.value.trim(),
        source_type: sourceType.value,
        document_name: documentName.value.trim(),
        content: text,
      }),
    })
    if (!resp.ok) {
      const msg = await safeReadText(resp)
      throw new Error(msg || `HTTP ${resp.status}`)
    }
    uploadResult.value = await resp.json()
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Неизвестная ошибка'
  } finally {
    loading.value = false
  }
}

// Helpers
async function safeReadText(r: Response): Promise<string> {
  try {
    const txt = await r.text()
    return txt
  } catch {
    return ''
  }
}

// Hybrid query state
const queryText = ref<string>('')
type UiFilter = { field: string; operator: '$eq'|'$gt'|'$gte'|'$lt'|'$lte'|'$ne'|'$in'|'$nin'; value: string }
const filters = ref<UiFilter[]>([])
const loadingSearch = ref<boolean>(false)
const searchError = ref<string | null>(null)
const searchResult = ref<Record<string, unknown> | null>(null)
const prettySearch = computed(() => (searchResult.value ? JSON.stringify(searchResult.value, null, 2) : ''))

function addFilter() {
  filters.value.push({ field: '', operator: '$eq', value: '' })
}
function removeFilter(idx: number) {
  filters.value.splice(idx, 1)
}

function coerceValue(raw: string): any {
  const t = raw.trim()
  if (t === '') return t
  if (t === 'true') return true
  if (t === 'false') return false
  if (!Number.isNaN(Number(t))) return Number(t)
  try {
    return JSON.parse(t)
  } catch {
    return t
  }
}

async function runQuery() {
  searchError.value = null
  searchResult.value = null
  try {
    loadingSearch.value = true
    const payload = {
      query_text: queryText.value.trim() || null,
      filters: filters.value
        .filter(f => f.field && f.operator)
        .map(f => ({ field: f.field.trim(), operator: f.operator, value: coerceValue(f.value) })),
      top_k: 5,
    }
    const resp = await fetch('/api/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!resp.ok) {
      const msg = await resp.text()
      throw new Error(msg || `HTTP ${resp.status}`)
    }
    searchResult.value = await resp.json()
  } catch (e: unknown) {
    searchError.value = e instanceof Error ? e.message : 'Неизвестная ошибка'
  } finally {
    loadingSearch.value = false
  }
}

// Clear DB
const resetting = ref(false)
async function resetDb() {
  if (!confirm('Очистить базу Chroma? Это удалит все загруженные документы.')) return
  try {
    resetting.value = true
    const resp = await fetch('/api/reset', { method: 'POST' })
    if (!resp.ok) {
      const msg = await resp.text()
      throw new Error(msg || `HTTP ${resp.status}`)
    }
    // Очистим локальное состояние
    clearForm()
    filters.value = []
    queryText.value = ''
    searchResult.value = null
    alert('База очищена')
  } catch (e: unknown) {
    alert(e instanceof Error ? e.message : 'Ошибка очистки')
  } finally {
    resetting.value = false
  }
}
</script>

<style scoped>
.container {
  max-width: 900px;
  margin: 0 auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

textarea {
  width: 100%;
  padding: 10px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 14px;
  border: 1px solid #ddd;
  border-radius: 8px;
  resize: vertical;
}

.actions {
  display: flex;
  gap: 8px;
}

.field { display: flex; flex-direction: column; gap: 4px; }
input, select {
  padding: 8px 10px;
  border: 1px solid #ddd;
  border-radius: 8px;
}

.search-col { display: flex; flex-direction: column; gap: 10px; }
.filters { display: flex; flex-direction: column; gap: 8px; }
.filters-header { display: flex; align-items: center; justify-content: space-between; }
.filter-row { display: grid; grid-template-columns: 2fr 120px 1fr auto; gap: 8px; align-items: center; }

button {
  padding: 8px 12px;
  border: none;
  border-radius: 8px;
  background: #3b82f6;
  color: white;
  cursor: pointer;
}

button.secondary {
  background: #6b7280;
}

button.danger {
  background: #ef4444;
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error {
  color: #b91c1c;
  background: #fee2e2;
  border: 1px solid #fecaca;
  padding: 8px;
  border-radius: 8px;
}

.result pre {
  background: #0b1020;
  color: #e5e7eb;
  padding: 12px;
  border-radius: 8px;
  overflow: auto;
}
</style>