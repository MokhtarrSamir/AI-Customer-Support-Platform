/* Authentication state.

   The role is never guessed or hardcoded: it always comes from GET /auth/me,
   which is the single source of truth returned by the backend. */

const Auth = {
  user: null,

  isAuthenticated() {
    return Boolean(this.user);
  },

  role() {
    return this.user ? this.user.role : null;
  },

  isRole(...roles) {
    return Boolean(this.user) && roles.includes(this.user.role);
  },

  /* Stores the token and the user profile after a successful login. */
  async signIn(email, password) {
    const result = await Api.auth.login(email, password);
    Token.save(result.access_token);

    try {
      return await this.refreshUser();
    } catch (error) {
      /* The backend lets a disabled account obtain a token, then refuses
         /auth/me with 403. The token is useless, so drop it here. */
      Token.clear();
      this.user = null;
      throw error;
    }
  },

  /* The backend returns no token on register, so the user logs in afterwards. */
  async signUp(name, email, password) {
    return Api.auth.register(name, email, password);
  },

  /* Loads the profile from the backend and caches it in memory. */
  async refreshUser() {
    this.user = await Api.auth.me();
    return this.user;
  },

  /* Called on app start: a stored token is only trusted after /auth/me
     confirms it is still valid. A 401 clears it inside api.js. */
  async restore() {
    if (!Token.read()) {
      this.user = null;
      return null;
    }

    try {
      return await this.refreshUser();
    } catch (error) {
      this.user = null;
      return null;
    }
  },

  /* No backend logout endpoint exists, so this only clears local state. */
  signOut() {
    Token.clear();
    this.user = null;
  },
};
