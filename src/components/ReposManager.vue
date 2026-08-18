<script setup>
import { ref } from 'vue'
import { api, errorText } from '../api.js'
import { useConfigPage } from '../useConfigPage.js'

const {
  config, loading, loadError, saving, dirty, saveError, lastSaved, load, save,
} = useConfigPage()

const editing = ref(null)
const preview = ref(null)
const fetchingKey = ref('')
const previewRepoKey = ref('')

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

function submitEditing() {
  const target = editing.value
  if (!target.key.trim()) {
    saveError.value = '仓库 Key 不能为空'
    return
  }
  const idx = config.value.repos.findIndex(r => r.key === target.key)
  if (idx === -1) config.value.repos.push(target)
  else config.value.repos[idx] = target
  editing.value = null
  save()
}

function removeRepo(repo) {
  if (!confirm(`确定删除仓库「${repo.displayName || repo.key}」吗？`)) return
  config.value.repos = config.value.repos.filter(r => r !== repo)
  save()
}

async function testFetch(repo) {
  fetchingKey.value = repo.key
  previewRepoKey.value = repo.key
  preview.value = null
  try {
    preview.value = await api.fetchRelease(repo.key, true)
  } catch (err) {
    saveError.value = errorText(err)
  } finally {
    fetchingKey.value = ''
  }
}

load()
</script>

<template>
  <section>
    <div v-if="loading" class="state-hint">加载配置中…</div>
    <div v-else-if="loadError" class="state-hint err">{{ loadError }}</div>
    <template v-else-if="config">
      <h2>仓库管理</h2>
      <p class="hint">配置 GitHub 仓库，供「查询 Release」类指令使用。</p>

      <div class="card">
        <table class="table">
          <thead>
            <tr>
              <th>Key</th>
              <th>显示名称</th>
              <th>仓库</th>
              <th>启用</th>
              <th class="th-ops">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="repo in config.repos" :key="repo.key" @click="editRepo(repo)">
              <td><code>{{ repo.key }}</code></td>
              <td>{{ repo.displayName }}</td>
              <td>
                <a v-if="repo.website" :href="repo.website" target="_blank" rel="noopener" @click.stop>
                  {{ repo.owner }}/{{ repo.name }}
                </a>
                <template v-else>{{ repo.owner }}/{{ repo.name }}</template>
              </td>
              <td><input v-model="repo.enabled" type="checkbox" @click.stop /></td>
              <td class="th-ops">
                <button class="btn sm" @click.stop="testFetch(repo)" :disabled="fetchingKey === repo.key">
                  {{ fetchingKey === repo.key ? '拉取中…' : '测试拉取' }}
                </button>
                <button class="btn sm danger" @click.stop="removeRepo(repo)">删除</button>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-if="!config.repos.length" class="state-hint">暂无仓库</div>
        <div class="actions">
          <button class="btn" @click="startAdd">+ 添加仓库</button>
        </div>
      </div>

      <div v-if="preview" class="card">
        <h3>测试拉取结果 · <code>{{ previewRepoKey }}</code></h3>
        <div class="kv">
          <div><span>版本号</span><b>{{ preview.tagName }}</b></div>
          <div><span>发布日期</span><b>{{ preview.publishedAt }}</b></div>
          <div><span>构建文件</span>
            <b><span v-for="a in preview.assets" :key="a" class="pill">{{ a }}</span></b>
          </div>
        </div>
        <h4>「release」模板渲染预览</h4>
        <pre class="mono-block">{{ preview.rendered }}</pre>
      </div>

      <div v-if="editing" class="card">
        <h3>{{ config.repos.some(r => r.key === editing.key) ? '编辑仓库' : '添加仓库' }}</h3>
        <div class="grid-2">
          <div class="field"><label>Key（唯一标识）</label><input v-model="editing.key" type="text" /></div>
          <div class="field"><label>显示名称</label><input v-model="editing.displayName" type="text" /></div>
          <div class="field"><label>GitHub Owner</label><input v-model="editing.owner" type="text" /></div>
          <div class="field"><label>GitHub 仓库名</label><input v-model="editing.name" type="text" /></div>
          <div class="field"><label>Windows 推荐文件（可选）</label><input v-model="editing.windowsFile" type="text" /></div>
          <div class="field"><label>Linux 推荐文件（可选）</label><input v-model="editing.linuxFile" type="text" /></div>
          <div class="field span-2"><label>官网 / 项目链接</label><input v-model="editing.website" type="text" /></div>
          <div class="field span-2 checkbox">
            <input v-model="editing.enabled" type="checkbox" />
            <span>启用该仓库</span>
          </div>
        </div>
        <div class="actions">
          <button class="btn primary" @click="submitEditing">确定</button>
          <button class="btn" @click="editing = null">取消</button>
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