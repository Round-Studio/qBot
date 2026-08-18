<script setup>
import { ref } from 'vue'
import { api } from '../api.js'

const props = defineProps({
  config: { type: Object, required: true },
  status: { type: Object, default: null },
  saving: { type: Boolean, default: false },
})
const emit = defineEmits(['save', 'toast'])

const busy = ref(false)
const configPath = ref('')

async function loadPath() {
  try {
    const info = await api.configPath()
    configPath.value = info.dir
  } catch {
    configPath.value = ''
  }
}
loadPath()

async function action(fn, okText) {
  busy.value = true
  try {
    const result = await fn()
    emit('toast', okText)
    if (result?.state === 'error' && result.error) {
      emit('toast', result.error)
    }
  } catch (err) {
    emit('toast', err.message)
  } finally {
    busy.value = false
  }
}


</script>

<template>
  <section>
    <h2>机器人设置</h2>
    <p class="hint">AppID / AppSecret 修改保存后会自动重启机器人。</p>

    <div class="card">
      <div class="field">
        <label>AppID</label>
        <input v-model="config.bot.appId" type="text" placeholder="例如 1*******3" />
      </div>
      <div class="field">
        <label>AppSecret</label>
        <input v-model="config.bot.appSecret" type="password" placeholder="你的机器人密钥" />
      </div>
      <div class="field">
        <label>Release 缓存时间（毫秒）</label>
        <input v-model.number="config.cacheTtlMs" type="number" min="0" step="1000" />
        <p class="field-hint">默认 3600000（1 小时）。缓存用于减少 GitHub API 请求次数。</p>
      </div>
      <div class="actions">
        <button class="btn primary" :disabled="saving" @click="emit('save')">
          {{ saving ? '保存中...' : '保存配置' }}
        </button>
      </div>
    </div>

    <div class="card">
      <h3>机器人控制</h3>
      <div class="status-lines">
        <div class="line">
          <span class="k">当前状态</span>
          <span class="v">
            {{ status?.state === 'running' ? '运行中' : status?.state === 'connecting' ? '连接中' : status?.state === 'error' ? '出错' : '已停止' }}
          </span>
        </div>
        <div class="line">
          <span class="k">AppID</span>
          <span class="v">{{ status?.appId || '未配置' }}</span>
        </div>
        <div v-if="status?.error" class="line">
          <span class="k">错误信息</span>
          <span class="v err-txt">{{ status.error }}</span>
        </div>
        <div v-if="status?.lastMessage" class="line">
          <span class="k">最近消息</span>
          <span class="v">{{ status.lastMessage.content }}</span>
        </div>
      </div>
      <div class="actions">
        <button class="btn" :disabled="busy" @click="action(api.startBot, '机器人已启动')">启动</button>
        <button class="btn" :disabled="busy" @click="action(api.restartBot, '机器人已重启')">重启</button>
        <button class="btn danger" :disabled="busy" @click="action(api.stopBot, '机器人已停止')">停止</button>
      </div>
      <p v-if="configPath" class="field-hint">配置文件目录：<code>{{ configPath }}</code></p>
    </div>
  </section>
</template>