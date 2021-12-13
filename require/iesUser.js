// iesUser: User Service
class iesUser {

    constructor(newUser) {
        let nu = newUser || {};
        this.username = nu.username || '';
        this.userId = nu.userId || -1;
        this.userLevel = nu.userLevel || 0;
        this.siteId = nu.siteId || '';
     }

}
module.exports = iesUser;
