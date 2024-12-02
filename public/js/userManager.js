export class UserManager {
  #cookieName = 'partyplanner_user';
  #cookieExpireDays = 30;

  getUserId() {
    const userId = this.#getCookie(this.#cookieName);
    return userId || this.#createNewUser();
  }

  setUsername(username) {
    const userId = this.getUserId();
    this.#setCookie(`${this.#cookieName}_name`, username, this.#cookieExpireDays);
    return userId;
  }

  getUsername() {
    return this.#getCookie(`${this.#cookieName}_name`);
  }

  #createNewUser() {
    const userId = 'user_' + new Date().getTime() + '_' + Math.random().toString(36).substr(2, 9);
    this.#setCookie(this.#cookieName, userId, this.#cookieExpireDays);
    return userId;
  }

  #setCookie(name, value, days) {
    const date = new Date();
    date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
    const expires = 'expires=' + date.toUTCString();
    document.cookie = name + '=' + value + ';' + expires + ';path=/';
  }

  #getCookie(name) {
    const nameEQ = name + '=';
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      let cookie = cookies[i];
      while (cookie.charAt(0) === ' ') {
        cookie = cookie.substring(1, cookie.length);
      }
      if (cookie.indexOf(nameEQ) === 0) {
        return cookie.substring(nameEQ.length, cookie.length);
      }
    }
    return null;
  }
}
