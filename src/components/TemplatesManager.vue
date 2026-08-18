<script setup>
import { ref } from 'vue'
import { api, errorText } from '../api.js'
import { useConfigPage } from '../useConfigPage.js'

const {
  config, loading, loadError, saving, dirty, saveError, lastSaved, load, save,
} = useConfigPage()

const editing = ref(null)
const preview = ref('')
const previewKind = ref('release')
const previewLoading = ref(false)
const previewError = ref('')

const RELEASE_VARS = [
  ['displayName', '仓库显示名称'],
  ['repoKey', '仓库 Key'],
  ['tagName', '最新版本号'],
  ['publishedAt', '发布日期'],
  ['website', '官网链接'],
  ['windowsFile', 'Windows 推荐文件'],
  ['linuxFile', 'Linux 推荐文件'],
  ['#assets', '构建文件列表（循环）'],
  ['^assets', '列表为空时（取反）'],
  ['#windowsFile', '存在 Windows 文件时'],
  ['^windowsFile', '不存在时（取反）'],
]

const ASSET_VARS = [
  ['name', '文件名'],
  ['url', '下载地址'],
]

const HELP_VARS = [
  ['#commands', '指令列表（循环）'],
  ['name', '指令名称'],
  ['description', '指令说明'],
  ['firstPattern', '第一个触发词'],
  ['patterns', '全部触发词'],
]

function startAdd() {
  editing.value = { key: '', name: '', content: '' }
}

function editTemplate(t) {
  editing.value = { ...t }
  preview.value = ''
  previewError.value = ''
}

function removeTemplate(t) {
  if (!confirm(`确定删除模板「${t.key}」吗？`)) return
  config.value.templates = config.value.templates.filter(x => x !== t)
  save()
}

function submitEditing() {
  const target = editing.value
  if (!target.key.trim()) {
    saveError.value = '模板 Key 不能为空'
    return
  }
  const idx = config.value.templates.findIndex(t => t.key === target.key)
  if (idx === -1) config.value.templates.push(target)
  else config.value.templates[idx] = target
  editing.value = null
  save()
}

function insertVar(name) {
  if (!editing.value) return
  const ta = document.getElementById('template-editor')
  const tag = name.startsWith('#') || name.startsWith('^')
    ? `{{${name}}}...{{/${name.slice(1)}}}`
    : `{{${name}}}`
  const start = ta ? ta.selectionStart : editing.value.content.length
  const end = ta ? ta.selectionEnd : editing.value.content.length
  editing.value.content =
    editing.value.content.slice(0, start) + tag + editing.value.content.slice(end)
  requestAnimationFrame(() => {
    if (ta) {
      ta.focus()
      ta.setSelectionRange(start + tag.length, start + tag.length)
    }
  })
}

async function doPreview() {
  if (!editing.value) return
  previewLoading.value = true
  previewError.value = ''
  try {
    const result = await api.preview({
      template: editing.value.content,
      kind: previewKind.value,
    })
    preview.value = result.rendered
  } catch (err) {
    previewError.value = errorText(err)
  } finally {
    previewLoading.value = false
  }
}

function varList(kind) {
  return kind === 'help' ? HELP_VARS : RELEASE_VARS
}

load()
</script>

<template>
  <section>
    <div v-if="loading" class="state-hint">加载配置中…</div>
    <div v-else-if="loadError" class="state-hint err">{{ loadError }}</div>
    <template v-else-if="config">
      <h2>模板管理</h2>
      <p class="hint">
        语法：<code>&#123;&#123;变量&#125;&#125;</code> 替换 ·
        <code>&#123;&#123;#列表&#125;&#125;…&#123;&#123;/列表&#125;&#125;</code> 循环 ·
        <code>&#123;&#123;^列表&#125;&#125;…&#123;&#123;/列表&#125;&#125;</code> 取反。
      </p>

      <div class="card">
        <table class="table">
          <thead>
            <tr>
              <th>Key</th>
              <th>名称</th>
              <th class="th-ops">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="t in config.templates" :key="t.key" @click="editTemplate(t)">
              <td><code>{{ t.key }}</code></td>
              <td>{{ t.name }}</td>
              <td class="th-ops">
                <button class="btn sm danger" @click.stop="removeTemplate(t)">删除</button>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-if="!config.templates.length" class="state-hint">暂无模板</div>
        <div class="actions">
          <button class="btn" @click="startAdd">+ 添加模板</button>
        </div>
      </div>

      <div v-if="editing" class="card">
        <h3>{{ config.templates.some(t => t.key === editing.key) ? '编辑模板' : '添加模板' }}</h3>
        <div class="grid-2">
          <div class="field"><label>模板 Key（指令中引用）</label><input v-model="editing.key" type="text" /></div>
          <div class="field"><label>模板名称</label><input v-model="editing.name" type="text" /></div>
        </div>

        <div class="field">
          <label>可用变量（点击插入）</label>
          <div class="pills-group">
            <button
              v-for="[v, desc] in varList('release')"
              :key="v"
              class="pill-btn"
              :title="desc"
              @click="insertVar(v)"
            >
              {{ v }}
            </button>
          </div>
          <p class="hint">循环内（#assets）可用：<code>&#123;&#123;name&#125;&#125;</code>、<code>&#123;&#123;url&#125;&#125;</code></p>
        </div>

        <div class="field">
          <label>模板内容（Markdown）</label>
          <textarea id="template-editor" v-model="editing.content" rows="16" class="mono-input"></textarea>
        </div>

        <div class="actions">
          <button class="btn primary" @click="submitEditing">确定</button>
          <button class="btn" @click="editing = null">取消</button>
          <span class="spacer"></span>
          <select v-model="previewKind">
            <option value="release">示例：Release 数据</option>
            <option value="help">示例：帮助数据</option>
          </select>
          <button class="btn" :disabled="previewLoading" @click="doPreview">
            {{ previewLoading ? '渲染中…' : '预览' }}
          </button>
        </div>

        <div v-if="previewError" class="strip err">{{ previewError }}</div>
        <div v-if="preview" class="field">
          <label>渲染结果预览</label>
          <pre class="mono-block">{{ preview }}</pre>
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