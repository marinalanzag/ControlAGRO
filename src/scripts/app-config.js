(function appConfigModule(globalScope) {
  const fallbackConfig = {
    supabaseUrl: "https://dgvkptcxchytqthjqozc.supabase.co",
    supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRndmtwdGN4Y2h5dHF0aGpxb3pjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg2NzAzMzksImV4cCI6MjA4NDI0NjMzOX0.4RbEeD-loZnLzi-mN4W8LmyH1vHAFef5gRbOfnSNGG4"
  };

  function getRuntimeConfig() {
    const runtimeConfig = globalScope.__CONTROLAGRO_CONFIG__ || {};
    return {
      supabaseUrl: runtimeConfig.supabaseUrl || fallbackConfig.supabaseUrl,
      supabaseAnonKey: runtimeConfig.supabaseAnonKey || fallbackConfig.supabaseAnonKey
    };
  }

  globalScope.ControlAgroAppConfig = {
    getRuntimeConfig
  };
})(window);
