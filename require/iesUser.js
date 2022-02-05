// iesUser: User Service
class iesUser {

    constructor(newUser) {
        let nu = newUser || {};
        this.userKey = nu.userKey || -1; // Database numeric key
        this.userName = nu.userName || '';
        this.userLogin = nu.userLogin || ''; // login text ID
        this.userEmail = nu.userEmail || '';
        this.userLevel = nu.userLevel || 0;
        this.siteId = nu.siteId || '';
        // userKey 0 is a valid Backdoor Admin
        if ((nu.userKey + '') == '0') {this.userKey = 0;}
     }

}
module.exports = iesUser;
