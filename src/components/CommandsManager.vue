<script setup>
import { defineProps, defineEmits, ref } from 'vue'

defineProps({
  config: { type: Object, required: true },
  repoOptions: { type: Array, default: () => [] },
  templateOptions: { type: Array, default: () => [] },
  saving: { type: Boolean, default: false },
})
const emit = defineEmits(['save', 'toast'])

const editing = ref(null)

const TYPE_LABELS = {
  release: '查询仓库 Release',
  help: '显示指令帮助',
  text: '回复固定文本',
}

function newCommand() {
  return {
    id: '',
    name: '',
    description: '',
    patterns: [],
    type: 'release',
    repoKey: '',
    templateKey: 'release',
    replyText: '',
    enabled: true,
  }
}

function startAdd() {
  editing.value = newCommand()
}

function editCommand(cmd) {
  editing.value = { ...cmd, patterns: [...(cmd.patterns || [])] }
}

function patternsText(cmd) {
  return (cmd.patterns || []).join(', ')
}

function setPatterns(cmd, text) {
  cmd.patterns = text
    .split(/[\s,，]+/)
    .map(s => s.trim())
    .filter(Boolean)
}

function confirmDelete(cmd) {
  if (!confirm(`确定删除指令「${cmd.name}」吗？`)) return
  config.value.commands = config.value.commands.filter(c => c !== cmd)
  emit('save')
}

function saveEditing() {
  const target = editing.value
  if (!target.name.trim()) {
    emit('toast', '指令名称不能为空')
    return
  }
  if (target.type === 'release' && !target.repoKey) {
    emit('toast', '请选择关联的仓库')
    return
  }
  const key = target.id
  const existing = key && config.value.commands.find(c => c.id === key)
  if (existing) {
    Object.assign(existing, target)
  } else {
    target.id = `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    config.value.commands.push(target)
  }
  editing.value = null
  emit('save')
}
</script>

<template>
  <section>
    <h2>指令管理</h2>
    <p class="hint">指令的触发词（patterns）、行为类型、关联仓库与模板均在此配置。</p>

    <div class="card">
      <table class="table">
        <thead>
          <tr>
            <th>名称</th>
            <th>触发词</th>
            <th>类型</th>
            <th>说明</th>
            <th>启用</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="cmd in config.commands" :key="cmd.id">
            <td><code>{{ cmd.name }}</code></td>
            <td class="patterns-cell">
              <span v-for="p in cmd.patterns" :key="p" class="tag">{{ p }}</span>
            </td>
            <td>{{ TYPE_LABELS[cmd.type] || cmd.type }}</td>
            <td class="desc-cell">{{ cmd.description }}</td>
            <td><input v-model="cmd.enabled" type="checkbox" /></td>
            <td class="ops">
              <button class="btn sm" @click="editCommand(cmd)">编辑</button>
              <button class="btn sm danger" @click="confirmDelete(cmd)">删除</button>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-if="!config.commands.length" class="placeholder">暂无指令，点击下方按钮添加</div>
      <div class="actions">
        <button class="btn primary" @click="startAdd">+ 添加指令</button>
        <button class="btn" :disabled="saving" @click="emit('save')">
          {{ saving ? '保存中...' : '保存配置' }}
        </button>
      </div>
    </div>

    <div v-if="editing" class="card">
      <h3>{{ config.commands.some(c => c.id === editing.id) ? '编辑指令' : '添加指令' }}</h3>
      <div class="grid-2">
        <div class="field">
          <label>指令名称</label>
          <input v-model="editing.name" type="text" placeholder="例如 bb" />
        </div>
        <div class="field">
          <label>指令类型</label>
          <select v-model="editing.type">
            <option value="release">查询仓库 Release</option>
            <option value="help">显示指令帮助</option>
            <option value="text">回复固定文本</option>
          </select>
        </div>
        <div class="field span-2">
          <label>触发词（逗号或空格分隔，例如 .bb, /bb, 。bb）</label>
          <input
            type="text"
            :value="patternsText(editing)"
            @input="setPatterns(editing, $event.target.value)"
            placeholder=".bb, /bb, 。bb"
          />
        </div>
        <div class="field span-2">
          <label>指令说明（帮助模板中显示）</label>
          <input v-model="editing.description" type="text" placeholder="获取最新构建文件" />
        </div>
        <template v-if="editing.type === 'release'">
          <div class="field">
            <label>关联仓库</label>
            <select v-model="editing.repoKey">
              <option value="" disabled>请选择仓库</option>
              <option v-for="key in repoOptions" :key="key" :value="key">{{ key }}</option>
            </select>
          </div>
          <div class="field">
            <label>消息模板</label>
            <select v-model="editing.templateKey">
              <option value="" disabled>请选择模板</option>
              <option v-for="key in templateOptions" :key="key" :value="key">{{ key }}</option>
            </select>
          </div>
        </template>
        <template v-if="editing.type === 'text'">
          <div class="field span-2">
            <label>回复文本（支持 <code>&#123;&#123;变量&#125;&#125;</code> 模板语法）</label>
            <textarea v-model="editing.replyText" rows="3" placeholder="要回复的固定文本"></textarea>
          </div>
        </template>
        <div class="field span-2 checkbox-field">
          <label class="checkbox">
            <input v-model="editing.enabled" type="checkbox" /> 启用该指令
          </label>
        </div>
      </div>
      <div class="actions">
        <button class="btn primary" @click="saveEditing">确定</button>
        <button class="btn" @click="editing = null">取消</button>
      </div>
    </div>
  </section>
</template>