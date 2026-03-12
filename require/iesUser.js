// iesUser: User Service
const FlexJson = require('./FlexJson/FlexJsonClass.js');
class iesUser {

    constructor(newUser) {
        if(!(newUser instanceof FlexJson)) {
            let nu = newUser || {};
            this.userid = nu.userid || -1; // Database numeric key
            this.userName = nu.userName || '';
            this.loginid = nu.loginid || ''; // login text ID
            this.userEmail = nu.userEmail || '';
            this.userLevel = nu.userLevel || 0;
            this.siteId = nu.siteId || '';
            // userid 0 is a valid Backdoor Admin
            if ((nu.userid + '') == '0') {this.userid = 0;}
        } else {
            this.userid = newUser.getNum("userid",-1); // Database numeric key
            this.userName = newUser.getStr("userName", '');
            this.loginid = newUser.getStr("loginid", ''); // login text ID
            this.userEmail = newUser.getStr("userEmail", '');
            this.userLevel = newUser.getNum("userLevel", 0);
            this.siteId = newUser.getStr("siteId", '');
            // userid 0 is a valid Backdoor Admin
        } 
    }

}
module.exports = iesUser;
