<script setup>
import { ref } from 'vue'
import { api } from '../api.js'

defineProps({
  config: { type: Object, required: true },
  saving: { type: Boolean, default: false },
})
const emit = defineEmits(['save', 'toast'])

const editing = ref(null)
const preview = ref(null)
const previewLoading = ref(false)

function newRepo() {
  return {
    key: '',
    displayName: '',
    owner: '',
    name: '',
    windowsFile: '',
    linuxFile: '',
    website: '',
    enabled: true,
  }
}

function startAdd() {
  editing.value = newRepo()
  preview.value = null
}

function editRepo(repo) {
  editing.value = { ...repo }
  preview.value = null
}

function confirmDelete(repo) {
  if (!confirm(`确定删除仓库「${repo.displayName || repo.key}」吗？`)) return
  config.value.repos = config.value.repos.filter(r => r !== repo)
  emit('save')
}

function saveEditing() {
  const target = editing.value
  if (!target.key.trim()) {
    emit('toast', '仓库 Key 不能为空')
    return
  }
  const idx = config.value.repos.findIndex(r => r.key === target.key)
  if (idx === -1) config.value.repos.push(target)
  else config.value.repos[idx] = target
  editing.value = null
  emit('save')
}

async function testFetch(repo) {
  previewLoading.value = true
  preview.value = null
  try {
    preview.value = await api.fetchRelease(repo.key, true)
    emit('toast', `已拉取最新 Release: ${preview.value.tagName}`)
  } catch (err) {
    emit('toast', err.message)
  } finally {
    previewLoading.value = false
  }
}

</script>

<template>
  <section>
    <h2>仓库管理</h2>
    <p class="hint">配置 GitHub 仓库，供「发布信息」类指令查询最新 Release。</p>

    <div class="card">
      <table class="table">
        <thead>
          <tr>
            <th>Key</th>
            <th>显示名称</th>
            <th>仓库</th>
            <th>启用</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="repo in config.repos" :key="repo.key">
            <td><code>{{ repo.key }}</code></td>
            <td>{{ repo.displayName }}</td>
            <td>
              <a v-if="repo.website" :href="repo.website" target="_blank" rel="noopener">
                {{ repo.owner }}/{{ repo.name }}
              </a>
              <template v-else>{{ repo.owner }}/{{ repo.name }}</template>
            </td>
            <td>
              <input v-model="repo.enabled" type="checkbox" />
            </td>
            <td class="ops">
              <button class="btn sm" @click="editRepo(repo)">编辑</button>
              <button class="btn sm" :disabled="previewLoading" @click="testFetch(repo)">
                {{ previewLoading ? '拉取中...' : '测试拉取' }}
              </button>
              <button class="btn sm danger" @click="confirmDelete(repo)">删除</button>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-if="!config.repos.length" class="placeholder">暂无仓库，点击下方按钮添加</div>
      <div class="actions">
        <button class="btn primary" @click="startAdd">+ 添加仓库</button>
        <button class="btn" :disabled="saving" @click="emit('save')">
          {{ saving ? '保存中...' : '保存配置' }}
        </button>
      </div>
    </div>

    <div v-if="preview" class="card">
      <h3>测试拉取结果</h3>
      <div class="status-lines">
        <div class="line"><span class="k">版本号</span><span class="v">{{ preview.tagName }}</span></div>
        <div class="line"><span class="k">发布日期</span><span class="v">{{ preview.publishedAt }}</span></div>
        <div class="line"><span class="k">构建文件数</span><span class="v">{{ preview.assetCount }}</span></div>
        <div class="line" v-if="preview.assets.length">
          <span class="k">文件列表</span>
          <span class="v"><span class="tag" v-for="a in preview.assets" :key="a">{{ a }}</span></span>
        </div>
      </div>
      <h4>用「release」模板渲染的效果</h4>
      <pre class="preview-md">{{ preview.rendered }}</pre>
    </div>

    <div v-if="editing" class="card">
      <h3>{{ config.repos.some(r => r.key === editing.key) ? '编辑仓库' : '添加仓库' }}</h3>
      <div class="grid-2">
        <div class="field">
          <label>Key（唯一标识，指令中引用）</label>
          <input v-model="editing.key" type="text" placeholder="例如 bedrockboot" />
        </div>
        <div class="field">
          <label>显示名称</label>
          <input v-model="editing.displayName" type="text" placeholder="例如 BedrockBoot" />
        </div>
        <div class="field">
          <label>GitHub Owner</label>
          <input v-model="editing.owner" type="text" placeholder="例如 Round-Studio" />
        </div>
        <div class="field">
          <label>GitHub 仓库名</label>
          <input v-model="editing.name" type="text" placeholder="例如 BedrockBoot" />
        </div>
        <div class="field">
          <label>Windows 推荐文件（可选）</label>
          <input v-model="editing.windowsFile" type="text" placeholder="例如 xxx-win.exe" />
        </div>
        <div class="field">
          <label>Linux 推荐文件（可选）</label>
          <input v-model="editing.linuxFile" type="text" placeholder="例如 xxx.AppImage" />
        </div>
        <div class="field span-2">
          <label>官网 / 项目链接</label>
          <input v-model="editing.website" type="text" placeholder="https://..." />
        </div>
        <div class="field span-2 checkbox-field">
          <label class="checkbox">
            <input v-model="editing.enabled" type="checkbox" /> 启用该仓库
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