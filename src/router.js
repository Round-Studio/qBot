import { createRouter, createWebHashHistory } from 'vue-router'
import BotSettings from './components/BotSettings.vue'
import ReposManager from './components/ReposManager.vue'
import CommandsManager from './components/CommandsManager.vue'
import TemplatesManager from './components/TemplatesManager.vue'

export default createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/settings' },
    { path: '/settings', component: BotSettings, meta: { title: '机器人设置' } },
    { path: '/repos', component: ReposManager, meta: { title: '仓库管理' } },
    { path: '/commands', component: CommandsManager, meta: { title: '指令管理' } },
    { path: '/templates', component: TemplatesManager, meta: { title: '模板管理' } },
  ],
})