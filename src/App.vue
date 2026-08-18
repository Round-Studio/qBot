<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { api } from './api.js'
import BotSettings from './components/BotSettings.vue'
import ReposManager from './components/ReposManager.vue'
import CommandsManager from './components/CommandsManager.vue'
import TemplatesManager from './components/TemplatesManager.vue'

const tabs = [
  { key: 'settings', label: '机器人设置' },
  { key: 'repos', label: '仓库管理' },
  { key: 'commands', label: '指令管理' },
  { key: 'templates', label: '模板管理' },
]

const currentTab = ref('settings')
const config = ref(null)
const status = ref(null)
const loading = ref(true)
const saving = ref(false)
const toast = ref('')
let toastTimer = null
let pollTimer = null

const statusText = computed(() => {
  const map = {
    running: { text: '运行中', cls: 'ok' },
    connecting: { text: '连接中', cls: 'warn' },
    stopped: { text: '已停止', cls: 'off' },
    error: { text: '出错', cls: 'err' },
  }
  return map[status.value?.state] || { text: '未知', cls: 'off' }
})

const uptimeText = computed(() => {
  const started = status.value?.startedAt
  if (!started) return ''
  const sec = Math.floor((Date.now() - started) / 1000)
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  return `${h}时 ${m}分 ${s}秒`
})

function showToast(message) {
  toast.value = message
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (toast.value = ''), 3000)
}

async function loadConfig() {
  try {
    config.value = await api.getConfig()
  } catch (err) {
    showToast(err.message)
  } finally {
    loading.value = false
  }
}

async function pollStatus() {
  try {
    status.value = await api.status()
  } catch {
    status.value = { state: 'error', error: '无法连接后端服务' }
  }
}

async function saveConfig() {
  if (!config.value) return
  saving.value = true
  try {
    const prev = config.value
    const saved = await api.saveConfig(config.value)
    config.value = saved
    const credsChanged =
      prev.bot?.appId !== saved.bot?.appId || prev.bot?.appSecret !== saved.bot?.appSecret
    showToast('配置已保存')
    if (credsChanged) {
      showToast('机器人凭证已变更，正在重启机器人...')
      await api.restartBot()
      await pollStatus()
    }
    await pollStatus()
  } catch (err) {
    showToast(err.message)
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  await Promise.all([loadConfig(), pollStatus()])
  pollTimer = setInterval(pollStatus, 3000)
})

onUnmounted(() => {
  clearInterval(pollTimer)
  clearTimeout(toastTimer)
})

const repoOptions = computed(() => (config.value?.repos || []).map(r => r.key))
const enabledRepoOptions = computed(() =>
  (config.value?.repos || []).filter(r => r.enabled !== false).map(r => r.key)
)
const templateOptions = computed(() => (config.value?.templates || []).map(t => t.key))
</script>

<template>
  <div class="layout">
    <header class="topbar">
      <div class="brand">
        <div class="logo">Q</div>
        <div>
          <h1>RoundStudio qBot 管理面板</h1>
          <p class="sub">QQ 机器人 · 配置存储在 %appdata%/RoundStudio/qBot</p>
        </div>
      </div>
      <div class="status-block">
        <span class="badge" :class="`badge-${statusText.cls}`">{{ statusText.text }}</span>
        <span v-if="status?.appId" class="meta">AppID: {{ status.appId }}</span>
        <span v-if="uptimeText" class="meta">已运行 {{ uptimeText }}</span>
        <span v-if="status?.error" class="meta err-meta" :title="status.error">{{ status.error }}</span>
      </div>
    </header>

    <nav class="tabs">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        class="tab"
        :class="{ active: currentTab === tab.key }"
        @click="currentTab = tab.key"
      >
        {{ tab.label }}
      </button>
    </nav>

    <main class="content">
      <div v-if="loading" class="placeholder">加载配置中...</div>
      <div v-else-if="config" class="page">
        <BotSettings
          v-if="currentTab === 'settings'"
          :config="config"
          :status="status"
          :saving="saving"
          @save="saveConfig"
          @toast="showToast"
        />
        <ReposManager
          v-else-if="currentTab === 'repos'"
          :config="config"
          :saving="saving"
          @save="saveConfig"
          @toast="showToast"
        />
        <CommandsManager
          v-else-if="currentTab === 'commands'"
          :config="config"
          :repo-options="enabledRepoOptions"
          :template-options="templateOptions"
          :saving="saving"
          @save="saveConfig"
          @toast="showToast"
        />
        <TemplatesManager
          v-else-if="currentTab === 'templates'"
          :config="config"
          :saving="saving"
          @save="saveConfig"
          @toast="showToast"
        />
      </div>
      <div v-else class="placeholder error-placeholder">
        无法加载配置，请确认后端服务已启动
      </div>
    </main>

    <Transition name="toast">
      <div v-if="toast" class="toast">{{ toast }}</div>
    </Transition>
  </div>
</template>