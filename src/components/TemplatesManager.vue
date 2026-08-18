<script setup>
import { ref } from 'vue'
import { api } from '../api.js'

defineProps({
  config: { type: Object, required: true },
  saving: { type: Boolean, default: false },
})
const emit = defineEmits(['save', 'toast'])

const editing = ref(null)
const preview = ref('')
const previewKind = ref('release')
const previewLoading = ref(false)

const RELEASE_VARS = [
  ['displayName', '仓库显示名称'],
  ['repoKey', '仓库 Key'],
  ['owner', 'GitHub Owner'],
  ['repoName', 'GitHub 仓库名'],
  ['tagName', '最新版本号'],
  ['releaseName', 'Release 标题'],
  ['publishedAt', '发布日期'],
  ['website', '官网链接'],
  ['windowsFile', 'Windows 推荐文件'],
  ['linuxFile', 'Linux 推荐文件'],
  ['#assets', '构建文件列表（循环）'],
  ['^assets', '无构建文件时（反循环）'],
  ['#windowsFile', '有 Windows 文件时'],
  ['^windowsFile', '无 Windows 文件时'],
]
const HELP_VARS = [
  ['#commands', '指令列表（循环）'],
  ['name', '指令名称'],
  ['description', '指令说明'],
  ['patterns', '全部触发词'],
  ['firstPattern', '第一个触发词'],
]

function startAdd() {
  editing.value = { key: '', name: '', content: '' }
}

function editTemplate(t) {
  editing.value = { ...t }
  preview.value = ''
}

function confirmDelete(t) {
  if (!confirm(`确定删除模板「${t.key}」吗？`)) return
  config.value.templates = config.value.templates.filter(x => x !== t)
  emit('save')
}

function saveEditing() {
  const target = editing.value
  if (!target.key.trim()) {
    emit('toast', '模板 Key 不能为空')
    return
  }
  const idx = config.value.templates.findIndex(t => t.key === target.key)
  if (idx === -1) config.value.templates.push(target)
  else config.value.templates[idx] = target
  editing.value = null
  emit('save')
}

function insertVar(name) {
  if (!editing.value) return
  const el = document.getElementById('template-editor')
  const textarea = el && el.querySelector('textarea')
  if (textarea) {
    const start = textarea.selectionStart ?? editing.value.content.length
    const end = textarea.selectionEnd ?? editing.value.content.length
    const tag = name.startsWith('#') || name.startsWith('^')
      ? `{{${name}}}...{{/${name.slice(1)}}}`
      : `{{${name}}}`
    editing.value.content =
      editing.value.content.slice(0, start) + tag + editing.value.content.slice(end)
    requestAnimationFrame(() => {
      textarea.focus()
      textarea.setSelectionRange(start + tag.length, start + tag.length)
    })
  } else {
    editing.value.content += `{{${name}}}`
  }
}

async function doPreview() {
  if (!editing.value) return
  previewLoading.value = true
  try {
    const result = await api.preview({
      template: editing.value.content,
      kind: previewKind.value,
    })
    preview.value = result.rendered
  } catch (err) {
    emit('toast', err.message)
  } finally {
    previewLoading.value = false
  }
}

function varList(kind) {
  return kind === 'help' ? HELP_VARS : RELEASE_VARS
}
</script>

<template>
  <section>
    <h2>模板管理</h2>
    <p class="hint">
      使用模板语法渲染 Markdown 消息。变量用 <code>&#123;&#123;变量名&#125;&#125;</code>，循环用
      <code>&#123;&#123;#列表&#125;&#125;...&#123;&#123;/列表&#125;&#125;</code>，取反用
      <code>&#123;&#123;^列表&#125;&#125;...&#123;&#123;/列表&#125;&#125;</code>。
    </p>

    <div class="card">
      <table class="table">
        <thead>
          <tr>
            <th>Key</th>
            <th>名称</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="t in config.templates" :key="t.key">
            <td><code>{{ t.key }}</code></td>
            <td>{{ t.name }}</td>
            <td class="ops">
              <button class="btn sm" @click="editTemplate(t)">编辑</button>
              <button class="btn sm danger" @click="confirmDelete(t)">删除</button>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-if="!config.templates.length" class="placeholder">暂无模板，点击下方按钮添加</div>
      <div class="actions">
        <button class="btn primary" @click="startAdd">+ 添加模板</button>
        <button class="btn" :disabled="saving" @click="emit('save')">
          {{ saving ? '保存中...' : '保存配置' }}
        </button>
      </div>
    </div>

    <div v-if="editing" class="card">
      <h3>{{ config.templates.some(t => t.key === editing.key) ? '编辑模板' : '添加模板' }}</h3>
      <div class="grid-2">
        <div class="field">
          <label>模板 Key（指令中引用）</label>
          <input v-model="editing.key" type="text" placeholder="例如 release" />
        </div>
        <div class="field">
          <label>模板名称</label>
          <input v-model="editing.name" type="text" placeholder="发布信息模板" />
        </div>
      </div>

      <div class="field">
        <label>可用变量（点击插入到光标处）</label>
        <div class="var-bar">
          <button
            v-for="[v, desc] in varList('release')"
            :key="v"
            class="btn sm"
            :title="desc"
            @click="insertVar(v)"
          >
            {{ v }}
          </button>
        </div>
        <p class="field-hint">循环内（#assets）可用：name（文件名）、url（下载地址）。</p>
      </div>

      <div class="field">
        <label>模板内容（Markdown）</label>
        <textarea
          id="template-editor"
          v-model="editing.content"
          rows="14"
          class="mono"
          placeholder="## {{displayName}} 最新构建信息..."
        ></textarea>
      </div>

      <div class="actions">
        <button class="btn primary" @click="saveEditing">确定</button>
        <button class="btn" @click="editing = null">取消</button>
        <span class="spacer"></span>
        <select v-model="previewKind">
          <option value="release">示例：Release 数据</option>
          <option value="help">示例：帮助数据</option>
        </select>
        <button class="btn" :disabled="previewLoading" @click="doPreview">预览</button>
      </div>

      <div v-if="preview" class="field">
        <label>渲染结果预览</label>
        <pre class="preview-md">{{ preview }}</pre>
      </div>
    </div>
  </section>
</template>