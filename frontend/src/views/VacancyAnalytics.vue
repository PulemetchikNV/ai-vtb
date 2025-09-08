<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { axiosInstance } from '../plugins/axios'
import Card from 'primevue/card'
import Button from 'primevue/button'
import Skeleton from 'primevue/skeleton'
import Message from 'primevue/message'
import Badge from 'primevue/badge'
import Divider from 'primevue/divider'
import VueApexCharts from 'vue3-apexcharts'

const route = useRoute()
const vacancyId = route.params.id as string

const loading = ref(true)
const error = ref('')
const vacancy = ref<any>(null)
const analytics = ref<any>(null)
const useTestData = ref(false)

// ApexCharts heatmap data
const chartOptions = computed(() => ({
  chart: {
    type: 'heatmap',
    height: 350,
    toolbar: {
      show: false
    }
  },
  title: {
    text: 'Активность прохождения интервью за последний год',
    style: {
      fontSize: '16px',
      fontWeight: 600,
      color: 'var(--text-color)'
    }
  },
  dataLabels: {
    enabled: false
  },
  stroke: {
    width: 1
  },
  plotOptions: {
    heatmap: {
      shadeIntensity: 0.5,
      radius: 0,
      useFillColorAsStroke: true,
      colorScale: {
        ranges: [
          { from: 0, to: 0, name: 'Нет', color: '#f3f4f6' },
          { from: 1, to: 2, name: 'Низкая', color: '#bfdbfe' },
          { from: 3, to: 5, name: 'Средняя', color: '#60a5fa' },
          { from: 6, to: 10, name: 'Высокая', color: '#3b82f6' },
          { from: 11, to: 999, name: 'Очень высокая', color: '#1d4ed8' }
        ]
      }
    }
  },
  tooltip: {
    custom: function({ series, seriesIndex, dataPointIndex, w }: any) {
      const monthName = w.globals.seriesNames[seriesIndex]
      const dayNumber = dataPointIndex + 1
      const value = series[seriesIndex][dataPointIndex]
      return `<div class="apexcharts-tooltip-custom">
        <div><strong>${dayNumber} ${monthName}</strong></div>
        <div>Интервью: ${value || 0}</div>
      </div>`
    }
  },
  xaxis: {
    labels: {
      show: true,
      formatter: function(value: any) {
        return value.toString()
      }
    }
  },
  yaxis: {
    labels: {
      show: true
    }
  },
  grid: {
    padding: {
      right: 20
    }
  }
}))

// Generate test data for beautiful visualization
function generateTestData() {
  const monthNames = [
    'Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн',
    'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'
  ]
  
  const testData: Record<string, Record<number, number>> = {}
  const now = new Date()
  
  for (let i = 11; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const monthName = monthNames[date.getMonth()]
    testData[monthName] = {}
    
    const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
    for (let day = 1; day <= daysInMonth; day++) {
      // Generate realistic patterns
      let value = 0
      
      // Weekdays have more activity
      const dayOfWeek = new Date(date.getFullYear(), date.getMonth(), day).getDay()
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
      
      // Base probability
      let probability = isWeekend ? 0.2 : 0.6
      
      // Seasonal patterns - higher activity in spring/fall
      const month = date.getMonth()
      if (month >= 2 && month <= 4) probability *= 1.4 // Spring
      if (month >= 8 && month <= 10) probability *= 1.3 // Fall
      if (month === 11 || month === 0) probability *= 0.7 // Winter holidays
      if (month >= 5 && month <= 7) probability *= 0.8 // Summer
      
      // Random generation with weighted probability
      if (Math.random() < probability) {
        // Most days have 1-3 interviews
        if (Math.random() < 0.7) {
          value = Math.floor(Math.random() * 3) + 1
        } 
        // Some days have higher activity (4-8)
        else if (Math.random() < 0.25) {
          value = Math.floor(Math.random() * 5) + 4
        }
        // Rare peak days (9-15)
        else {
          value = Math.floor(Math.random() * 7) + 9
        }
      }
      
      testData[monthName][day] = value
    }
  }
  
  return testData
}

const chartSeries = computed(() => {
  const monthNames = [
    'Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн',
    'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'
  ]
  
  let monthlyData: Record<string, Record<number, number>> = {}
  
  if (useTestData.value) {
    // Use generated test data
    monthlyData = generateTestData()
  } else {
    // Use real data
    if (!analytics.value?.chatsByDate) return []
    
    // Initialize months for last year
    const now = new Date()
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthName = monthNames[date.getMonth()]
      monthlyData[monthName] = {}
      
      // Initialize all days in month
      const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
      for (let day = 1; day <= daysInMonth; day++) {
        monthlyData[monthName][day] = 0
      }
    }
    
    // Fill actual data
    Object.entries(analytics.value.chatsByDate).forEach(([dateStr, stats]: [string, any]) => {
      const date = new Date(dateStr)
      const monthName = monthNames[date.getMonth()]
      const day = date.getDate()
      
      if (monthlyData[monthName]) {
        monthlyData[monthName][day] = stats.total
      }
    })
  }
  
  // Convert to ApexCharts format
  const series = Object.entries(monthlyData).map(([monthName, days]) => ({
    name: monthName,
    data: Object.entries(days)
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .map(([day, count]) => ({
        x: parseInt(day),
        y: count
      }))
  }))
  
  return series.reverse() // Show recent months at top
})

function toggleTestData() {
  useTestData.value = !useTestData.value
}

async function loadData() {
  try {
    loading.value = true
    error.value = ''
    
    // Load vacancy details and analytics in parallel
    const [vacancyResponse, analyticsResponse] = await Promise.all([
      axiosInstance.get(`/vacancy/${vacancyId}`),
      axiosInstance.get(`/vacancy/${vacancyId}/analytics`)
    ])
    
    vacancy.value = vacancyResponse.data
    analytics.value = analyticsResponse.data
  } catch (err: any) {
    console.error('Failed to load vacancy analytics:', err)
    error.value = err.response?.data?.error || 'Ошибка загрузки данных'
  } finally {
    loading.value = false
  }
}

function getRequirementTypeLabel(type: string) {
  const types: Record<string, string> = {
    'technical_skill': 'Hard скилл',
    'soft_skill': 'Soft скилл',
    'other': 'Другое'
  }
  return types[type] || type
}

onMounted(loadData)
</script>

<template>
  <div class="analytics-page">
    <div class="analytics-container">
      <!-- Header -->
      <div class="page-header">
        <div class="header-content">
          <Button 
            icon="pi pi-arrow-left" 
            text 
            rounded 
            @click="$router.push('/vacancies')"
            class="back-button"
          />
          <div class="title-section">
            <h1 class="page-title">
              <i class="pi pi-chart-line"></i>
              Аналитика вакансии
            </h1>
            <p v-if="vacancy" class="vacancy-title">{{ vacancy.title }}</p>
          </div>
        </div>
      </div>

      <!-- Error Message -->
      <Message v-if="error" severity="error" :closable="false" class="error-message">
        {{ error }}
      </Message>

      <!-- Loading State -->
      <div v-if="loading" class="loading-state">
        <Card>
          <template #content>
            <div class="skeleton-content">
              <Skeleton height="2rem" class="mb-4" />
              <Skeleton height="300px" class="mb-4" />
              <Skeleton height="1.5rem" width="60%" class="mb-2" />
              <Skeleton height="1rem" width="80%" class="mb-2" />
              <Skeleton height="1rem" width="70%" />
            </div>
          </template>
        </Card>
      </div>

      <!-- Analytics Content -->
      <div v-else-if="!error" class="analytics-content">
        <!-- Stats Overview -->
        <div class="stats-grid">
          <Card class="stat-card">
            <template #content>
              <div class="stat-item">
                <div class="stat-icon total">
                  <i class="pi pi-users"></i>
                </div>
                <div class="stat-details">
                  <div class="stat-value">{{ analytics?.totalChats || 0 }}</div>
                  <div class="stat-label">Всего интервью</div>
                </div>
              </div>
            </template>
          </Card>

          <Card class="stat-card">
            <template #content>
              <div class="stat-item">
                <div class="stat-icon finished">
                  <i class="pi pi-check-circle"></i>
                </div>
                <div class="stat-details">
                  <div class="stat-value">{{ analytics?.finishedChats || 0 }}</div>
                  <div class="stat-label">Завершено</div>
                </div>
              </div>
            </template>
          </Card>

          <Card class="stat-card">
            <template #content>
              <div class="stat-item">
                <div class="stat-icon analyzed">
                  <i class="pi pi-chart-bar"></i>
                </div>
                <div class="stat-details">
                  <div class="stat-value">{{ analytics?.analyzedChats || 0 }}</div>
                  <div class="stat-label">С анализом</div>
                </div>
              </div>
            </template>
          </Card>

          <Card class="stat-card">
            <template #content>
              <div class="stat-item">
                <div class="stat-icon percentage">
                  <i class="pi pi-percentage"></i>
                </div>
                <div class="stat-details">
                  <div class="stat-value">
                    {{ analytics?.totalChats ? Math.round((analytics.finishedChats / analytics.totalChats) * 100) : 0 }}%
                  </div>
                  <div class="stat-label">Завершаемость</div>
                </div>
              </div>
            </template>
          </Card>
        </div>

        <!-- Heatmap Chart -->
        <Card class="chart-card">
          <template #header>
            <div class="chart-header">
              <div class="chart-title">
                <i class="pi pi-calendar"></i>
                Календарь активности
              </div>
              <Button 
                :label="useTestData ? 'Реальные данные' : 'Тестовые данные'"
                :icon="useTestData ? 'pi pi-database' : 'pi pi-sparkles'"
                size="small"
                :severity="useTestData ? 'secondary' : 'success'"
                outlined
                @click="toggleTestData"
                class="test-data-btn"
                v-tooltip.top="useTestData ? 'Переключиться на реальные данные' : 'Заполнить тестовыми данными для демонстрации'"
              />
            </div>
          </template>
          <template #content>
            <div v-if="chartSeries.length > 0">
              <VueApexCharts
                type="heatmap"
                height="350"
                :options="chartOptions"
                :series="chartSeries"
              />
            </div>
            <div v-else class="no-data">
              <i class="pi pi-chart-line"></i>
              <p>Нет данных для отображения за последний год</p>
            </div>
          </template>
        </Card>

        <!-- Vacancy Details -->
        <Card class="vacancy-details-card">
          <template #title>
            <div class="card-title">
              <i class="pi pi-briefcase"></i>
              Описание вакансии
            </div>
          </template>
          <template #content>
            <div class="vacancy-details">
              <div class="detail-section">
                <h3 class="detail-title">{{ vacancy?.title }}</h3>
                <div class="detail-meta">
                  <Badge 
                    value="Активна" 
                    severity="success" 
                    class="status-badge"
                  />
                  <span class="detail-date">
                    Создана: {{ new Date(vacancy?.createdAt).toLocaleDateString('ru-RU') }}
                  </span>
                </div>
              </div>

              <Divider />

              <div class="description-section">
                <h4 class="section-title">Описание позиции</h4>
                <div class="description-text">{{ vacancy?.description_text }}</div>
              </div>

              <Divider />

              <div class="requirements-section">
                <h4 class="section-title">Требования</h4>
                <div class="requirements-list">
                  <div 
                    v-for="(req, index) in vacancy?.requirements_checklist" 
                    :key="req.id || index"
                    class="requirement-item"
                  >
                    <div class="req-header">
                      <Badge 
                        :value="getRequirementTypeLabel(req.type)" 
                        :severity="req.type === 'technical_skill' ? 'info' : 'secondary'"
                        class="req-type-badge"
                      />
                      <span class="req-weight">Вес: {{ req.weight }}/10</span>
                    </div>
                    <div class="req-description">{{ req.description }}</div>
                  </div>
                </div>
              </div>

              <Divider v-if="vacancy?.category_weights" />

              <div v-if="vacancy?.category_weights" class="weights-section">
                <h4 class="section-title">Веса категорий</h4>
                <div class="weights-grid">
                  <div 
                    v-for="(weight, category) in vacancy.category_weights" 
                    :key="category"
                    class="weight-item"
                  >
                    <span class="weight-label">{{ getRequirementTypeLabel(category) }}</span>
                    <div class="weight-bar">
                      <div 
                        class="weight-fill" 
                        :style="{ width: `${weight * 100}%` }"
                      ></div>
                    </div>
                    <span class="weight-value">{{ Math.round(weight * 100) }}%</span>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </Card>
      </div>
    </div>
  </div>
</template>

<style scoped>
.analytics-page {
  min-height: 100vh;
  background: var(--surface-ground);
  padding: 1rem;
}

.analytics-container {
  max-width: 1200px;
  margin: 0 auto;
}

/* Header */
.page-header {
  margin-bottom: 2rem;
}

.header-content {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.back-button {
  flex-shrink: 0;
}

.title-section {
  flex: 1;
}

.page-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 2rem;
  font-weight: 700;
  margin: 0 0 0.25rem 0;
  color: var(--text-color);
}

.vacancy-title {
  font-size: 1.1rem;
  color: var(--text-color-secondary);
  margin: 0;
}

/* Error and Loading */
.error-message {
  margin-bottom: 2rem;
}

.loading-state {
  margin-bottom: 2rem;
}

.skeleton-content {
  padding: 1rem;
}

/* Stats Grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.stat-card {
  border: 1px solid var(--surface-border);
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.5rem;
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  font-size: 1.5rem;
  color: white;
}

.stat-icon.total { background: var(--p-primary-color); }
.stat-icon.finished { background: #10b981; }
.stat-icon.analyzed { background: #f59e0b; }
.stat-icon.percentage { background: #8b5cf6; }

.stat-details {
  flex: 1;
}

.stat-value {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--text-color);
  line-height: 1;
}

.stat-label {
  font-size: 0.875rem;
  color: var(--text-color-secondary);
  margin-top: 0.25rem;
}

/* Chart */
.chart-card {
  margin-bottom: 2rem;
  border: 1px solid var(--surface-border);
}

.chart-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--surface-border);
  background: var(--surface-section);
}

.chart-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text-color);
}

.chart-title i {
  color: var(--p-primary-color);
}

.test-data-btn {
  transition: all 0.2s ease;
}

.test-data-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.no-data {
  text-align: center;
  padding: 4rem 2rem;
  color: var(--text-color-secondary);
}

.no-data i {
  font-size: 3rem;
  margin-bottom: 1rem;
  display: block;
}

/* Vacancy Details */
.vacancy-details-card {
  border: 1px solid var(--surface-border);
}

.card-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.25rem;
  font-weight: 600;
}

.vacancy-details {
  padding: 0;
}

.detail-section {
  margin-bottom: 1rem;
}

.detail-title {
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0 0 0.5rem 0;
  color: var(--text-color);
}

.detail-meta {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.detail-date {
  font-size: 0.9rem;
  color: var(--text-color-secondary);
}

.section-title {
  font-size: 1.1rem;
  font-weight: 600;
  margin: 0 0 1rem 0;
  color: var(--text-color);
}

.description-text {
  line-height: 1.6;
  color: var(--text-color);
  white-space: pre-wrap;
}

/* Requirements */
.requirements-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.requirement-item {
  padding: 1rem;
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  background: var(--surface-section);
}

.req-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.req-weight {
  font-size: 0.875rem;
  color: var(--text-color-secondary);
  font-weight: 500;
}

.req-description {
  color: var(--text-color);
  line-height: 1.5;
}

/* Weights */
.weights-grid {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.weight-item {
  display: grid;
  grid-template-columns: 120px 1fr auto;
  gap: 1rem;
  align-items: center;
}

.weight-label {
  font-weight: 500;
  color: var(--text-color);
}

.weight-bar {
  height: 8px;
  background: var(--surface-border);
  border-radius: 4px;
  overflow: hidden;
}

.weight-fill {
  height: 100%;
  background: var(--p-primary-color);
  transition: width 0.3s ease;
}

.weight-value {
  font-weight: 600;
  color: var(--text-color);
  min-width: 40px;
  text-align: right;
}

/* Responsive */
@media (max-width: 768px) {
  .analytics-page {
    padding: 0.5rem;
  }
  
  .page-title {
    font-size: 1.5rem;
  }
  
  .stats-grid {
    grid-template-columns: 1fr;
  }
  
  .stat-item {
    padding: 1rem;
  }
  
  .header-content {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }
  
  .weight-item {
    grid-template-columns: 1fr;
    gap: 0.5rem;
  }
}

/* ApexCharts tooltip custom styling */
:global(.apexcharts-tooltip-custom) {
  background: var(--surface-overlay) !important;
  border: 1px solid var(--surface-border) !important;
  border-radius: 6px !important;
  padding: 8px 12px !important;
  color: var(--text-color) !important;
  font-size: 0.875rem !important;
}
</style>
