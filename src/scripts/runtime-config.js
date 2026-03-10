(function runtimeConfigModule(globalScope) {
  // Override this object per environment without changing app source.
  // Example:
  // globalScope.__CONTROLAGRO_CONFIG__ = {
  //   supabaseUrl: "https://your-project.supabase.co",
  //   supabaseAnonKey: "your-anon-key"
  // };
  globalScope.__CONTROLAGRO_CONFIG__ = globalScope.__CONTROLAGRO_CONFIG__ || {};
})(window);
