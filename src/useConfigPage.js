import { ref, watch } from 'vue'
import { api, errorText } from './api.js'

// 每个页面独立加载/保存配置（支持多标签页打开不同页面，互不干扰）
export function useConfigPage() {
  const config = ref(null)
  const loading = ref(true)
  const loadError = ref('')
  const saving = ref(false)
  const dirty = ref(false)
  const saveError = ref('')
  const lastSaved = ref('')
  let skipTracking = false

  async function load() {
    loading.value = true
    loadError.value = ''
    try {
      config.value = await api.getConfig()
    } catch (err) {
      loadError.value = errorText(err)
    } finally {
      loading.value = false
    }
  }

  // 任何字段变化都标记为“有未保存修改”；
  // 整体替换（加载 / 保存后重新拉取）不算修改
  watch(
    config,
    (val, old) => {
      if (!val || val === old) return
      if (skipTracking) return
      dirty.value = true
    },
    { deep: true }
  )

  async function save() {
    if (!config.value || saving.value) return
    saving.value = true
    saveError.value = ''
    try {
      await api.saveConfig(config.value)
      // 保存后重新拉取一遍，验证确实写入磁盘
      skipTracking = true
      config.value = await api.getConfig()
      skipTracking = false
      dirty.value = false
      lastSaved.value = new Date().toLocaleTimeString('zh-CN', { hour12: false })
    } catch (err) {
      saveError.value = `${errorText(err)}（配置未保存）`
    } finally {
      saving.value = false
    }
  }

  return {
    config,
    loading,
    loadError,
    saving,
    dirty,
    saveError,
    lastSaved,
    load,
    save,
  }
}