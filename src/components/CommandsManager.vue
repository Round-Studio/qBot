<script setup>
import { ref, computed } from 'vue'
import { useConfigPage } from '../useConfigPage.js'

const {
  config, loading, loadError, saving, dirty, saveError, lastSaved, load, save,
} = useConfigPage()

const editing = ref(null)

const TYPE_LABELS = {
  release: '查询 Release',
  help: '指令帮助',
  text: '固定文本',
}

const activeRepoKeys = computed(() =>
  (config.value?.repos || []).filter(r => r.enabled !== false).map(r => r.key)
)
const templateKeys = computed(() => (config.value?.templates || []).map(t => t.key))

function newCommand() {
  return {
    id: '',
    name: '',
    description: '',
    keywords: [],
    prefixes: [...(config.value?.defaultPrefixes || ['.', '/', '。'])],
    type: 'release',
    repoKey: activeRepoKeys.value[0] || '',
    templateKey: 'release',
    replyText: '',
    enabled: true,
  }
}

function startAdd() {
  editing.value = newCommand()
}

function editCommand(cmd) {
  editing.value = {
    ...cmd,
    keywords: [...(cmd.keywords || [])],
    prefixes: [...(cmd.prefixes || [])],
  }
}

function listText(list) {
  return (list || []).join(' ')
}

function setList(target, field, text) {
  target[field] = text
    .split(/\s+/)
    .map(s => s.trim())
    .filter(Boolean)
}

function removeCommand(cmd) {
  if (!confirm(`确定删除指令「${cmd.name}」吗？`)) return
  config.value.commands = config.value.commands.filter(c => c !== cmd)
  save()
}

function submitEditing() {
  const target = editing.value
  if (!target.name.trim()) {
    saveError.value = '指令名称不能为空'
    return
  }
  if (!target.keywords.length) {
    saveError.value = '至少需要一个触发关键词'
    return
  }
  if (target.type === 'release' && !target.repoKey) {
    saveError.value = '请选择关联仓库'
    return
  }
  const existing = config.value.commands.find(c => c.id === target.id)
  if (existing) Object.assign(existing, target)
  else {
    target.id = `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    config.value.commands.push(target)
  }
  editing.value = null
  save()
}

function showToken(cmd) {
  const p = (cmd.prefixes && cmd.prefixes.length ? cmd.prefixes : ['.'])
  const k = cmd.keywords && cmd.keywords.length ? cmd.keywords : [cmd.name || '']
  return (p[0] || '') + k[0]
}

load()
</script>

<template>
  <section>
    <div v-if="loading" class="state-hint">加载配置中…</div>
    <div v-else-if="loadError" class="state-hint err">{{ loadError }}</div>
    <template v-else-if="config">
      <h2>指令管理</h2>
      <p class="hint">
        匹配规则：消息开头去掉 @ 提及后，以「前缀 + 关键词」整体匹配（大小写不敏感），后跟空格或结尾即为命中。
        例如关键词 <code>bb</code> + 前缀 <code>.</code> 可触发 <code>.bb</code> 和 <code>.bb 参数</code>。
      </p>

      <div class="card">
        <table class="table">
          <thead>
            <tr>
              <th>指令</th>
              <th>关键词</th>
              <th>前缀</th>
              <th>类型</th>
              <th>说明</th>
              <th>启用</th>
              <th class="th-ops">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="cmd in config.commands" :key="cmd.id" @click="editCommand(cmd)">
              <td><code>{{ cmd.name }}</code></td>
              <td class="td-pills"><span v-for="k in cmd.keywords" :key="k" class="pill">{{ k }}</span></td>
              <td class="td-pills"><span v-for="p in cmd.prefixes" :key="p" class="pill dim">{{ p || '（无）' }}</span></td>
              <td>{{ TYPE_LABELS[cmd.type] || cmd.type }}</td>
              <td class="td-desc">{{ cmd.description }}</td>
              <td><input v-model="cmd.enabled" type="checkbox" @click.stop /></td>
              <td class="th-ops">
                <button class="btn sm danger" @click.stop="removeCommand(cmd)">删除</button>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-if="!config.commands.length" class="state-hint">暂无指令</div>
        <div class="actions">
          <button class="btn" @click="startAdd">+ 添加指令</button>
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
              <option value="release">查询 Release</option>
              <option value="help">显示指令帮助</option>
              <option value="text">回复固定文本</option>
            </select>
          </div>
          <div class="field span-2">
            <label>触发关键词（空格分隔，例如 bb bedrockboot）</label>
            <input
              type="text"
              :value="listText(editing.keywords)"
              @input="setList(editing, 'keywords', $event.target.value)"
              placeholder="bb bedrockboot"
            />
          </div>
          <div class="field span-2">
            <label>指令前缀（空格分隔，例如 . / 。 留空则使用全局默认）</label>
            <input
              type="text"
              :value="listText(editing.prefixes)"
              @input="setList(editing, 'prefixes', $event.target.value)"
              placeholder=". / 。"
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
                <option v-for="key in activeRepoKeys" :key="key" :value="key">{{ key }}</option>
              </select>
            </div>
            <div class="field">
              <label>消息模板</label>
              <select v-model="editing.templateKey">
                <option value="" disabled>请选择模板</option>
                <option v-for="key in templateKeys" :key="key" :value="key">{{ key }}</option>
              </select>
            </div>
          </template>
          <template v-if="editing.type === 'text'">
            <div class="field span-2">
              <label>回复文本（支持 <code>&#123;&#123;变量&#125;&#125;</code> 模板语法）</label>
              <textarea v-model="editing.replyText" rows="3"></textarea>
            </div>
          </template>
          <div class="field span-2 checkbox">
            <input v-model="editing.enabled" type="checkbox" />
            <span>启用该指令</span>
          </div>
        </div>
        <div class="actions">
          <button class="btn primary" @click="submitEditing">确定</button>
          <button class="btn" @click="editing = null">取消</button>
          <span class="spacer"></span>
          <span class="hint">触发示例：<code>{{ showToken(editing) }}</code></span>
        </div>
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