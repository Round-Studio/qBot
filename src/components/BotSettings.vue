<script setup>
import { ref } from 'vue'
import { api, errorText } from '../api.js'
import { useConfigPage } from '../useConfigPage.js'

const {
  config, loading, loadError, saving, dirty, saveError, lastSaved, load, save,
} = useConfigPage()

const busy = ref(false)
const pathInfo = ref(null)

async function loadPath() {
  try {
    pathInfo.value = await api.configPath()
  } catch {
    /* 忽略 */
  }
}

async function botAction(fn, okText) {
  busy.value = true
  try {
    const result = await fn()
    if (result?.state === 'error' && result.error) {
      saveError.value = result.error
    }
  } catch (err) {
    saveError.value = errorText(err)
  } finally {
    busy.value = false
  }
}

load()
loadPath()
</script>

<template>
  <section>
    <div v-if="loading" class="state-hint">加载配置中…</div>
    <div v-else-if="loadError" class="state-hint err">{{ loadError }}</div>
    <template v-else-if="config">
      <h2>机器人设置</h2>
      <p class="hint">AppID / AppSecret 修改保存后，机器人将自动重启并重新连接。</p>

      <div class="card">
        <div class="grid-2">
          <div class="field">
            <label>AppID</label>
            <input v-model="config.bot.appId" type="text" placeholder="例如 102813393" />
          </div>
          <div class="field">
            <label>AppSecret</label>
            <input v-model="config.bot.appSecret" type="password" placeholder="机器人密钥" />
          </div>
          <div class="field">
            <label>Release 缓存时间（毫秒）</label>
            <input v-model.number="config.cacheTtlMs" type="number" min="0" step="1000" />
          </div>
          <div class="field">
            <label>默认指令前缀</label>
            <input
              type="text"
              :value="(config.defaultPrefixes || []).join(' ')"
              @input="config.defaultPrefixes = $event.target.value.split(/\s+/).filter(Boolean)"
              placeholder=". / 。"
            />
          </div>
        </div>
      </div>

      <div class="card">
        <h3>机器人控制</h3>
        <p class="hint">机器人运行状态显示在页面右上角，每 3 秒自动刷新。</p>
        <div class="actions">
          <button class="btn primary" :disabled="busy" @click="botAction(api.startBot)">启动</button>
          <button class="btn" :disabled="busy" @click="botAction(api.restartBot)">重启</button>
          <button class="btn danger" :disabled="busy" @click="botAction(api.stopBot)">停止</button>
        </div>
        <p v-if="pathInfo" class="hint">配置文件：<code>{{ pathInfo.file }}</code></p>
      </div>

      <div class="savebar" :class="{ 'savebar-dirty': dirty }">
        <div class="savebar-info">
          <template v-if="saveError"><span class="err-block">{{ saveError }}</span></template>
          <template v-else-if="dirty"><span class="warn-block">有未保存的修改</span></template>
          <template v-else><span class="ok-block">已保存{{ lastSaved ? ' · ' + lastSaved : '' }}</span></template>
        </div>
        <button class="btn primary" :disabled="saving || !dirty" @click="save">
          {{ saving ? '保存中…' : '保存配置' }}
        </button>
      </div>
    </template>
  </section>
</template>