<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { api } from './api.js'

const status = ref(null)
const configDir = ref('')
let pollTimer = null

const stateMap = {
  running: { text: '运行中', cls: 'ok' },
  connecting: { text: '连接中', cls: 'warn' },
  stopped: { text: '已停止', cls: 'off' },
  error: { text: '出错', cls: 'err' },
}

const stateItem = computed(
  () => stateMap[status.value?.state] || { text: '未知', cls: 'off' }
)

async function pollStatus() {
  try {
    status.value = await api.status()
  } catch {
    status.value = { state: 'error', error: '无法连接后端服务' }
  }
}

onMounted(async () => {
  await pollStatus()
  try {
    const info = await api.configPath()
    configDir.value = info.dir
  } catch {
    /* 忽略 */
  }
  pollTimer = setInterval(pollStatus, 3000)
})

onUnmounted(() => clearInterval(pollTimer))
</script>

<template>
  <div class="layout">
    <header class="topbar">
      <div class="brand">
        <div class="logo">Q</div>
        <div class="brand-text">
          <h1>RoundStudio qBot</h1>
          <p>管理面板 · 每个页面可独立打开标签页</p>
        </div>
      </div>
      <div class="status-block">
        <span class="state" :class="`state-${stateItem.cls}`">{{ stateItem.text }}</span>
        <span v-if="status?.appId" class="muted">{{ status.appId }}</span>
        <span v-if="status?.error" class="muted err" :title="status.error">{{ status.error }}</span>
      </div>
    </header>

    <nav class="nav">
      <router-link to="/settings">机器人设置</router-link>
      <router-link to="/repos">仓库管理</router-link>
      <router-link to="/commands">指令管理</router-link>
      <router-link to="/templates">模板管理</router-link>
    </nav>

    <main class="content">
      <router-view />
    </main>

    <footer class="footer">
      <span>配置目录：<code>{{ configDir || '…' }}</code></span>
    </footer>
  </div>
</template>