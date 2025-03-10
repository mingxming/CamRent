<template>
  <div id="app-container">
    <h1 v-if="$route.path === '/'" style="text-align:center;margin-top:50px;">
      相机租赁系统正在加载...
    </h1>
    <router-view></router-view>
  </div>
</template> 