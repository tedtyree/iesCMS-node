// iesUser: User Service
class iesUser {

    constructor(newUser) {
        let nu = newUser || {};
        this.username = nu.username || '';
        this.userid = nu.userid || -1;
        this.userlevel = nu.userlevel || 0;
        this.siteid = nu.siteid || '';
     }

}
module.exports = iesUser;
