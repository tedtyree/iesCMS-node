
console.log("here12345");

function qcall3() {
    return new Promise((resolve,reject) => {
        setTimeout((err) => {
            if(err) {
                console.log("ERROR: QCALL3(): " + err);
                reject(false);
                //return false;
            } else {
                console.log("QCALL3 Complete!");
                resolve(true);
                //return true;
            }
        }, 3000);
    });
}

function qcall2a() {
    return new Promise( async (resolve,reject) => {
        await qcall3();
        setTimeout((err) => {
            if(err) {
                console.log("ERROR: QCALL2(): " + err);
                reject(false);
                //return false;
            } else {
                console.log("QCALL2 Complete!");
                resolve(true);
                //return true;
            }
        }, 2000);
    });
}

async function qcall2() {
    await qcall3();
    setTimeout((err) => {
        if(err) {
            console.log("ERROR: QCALL2(): " + err);
            throw new Error("ERROR: QCALL2(): " + err);
        } else {
            console.log("QCALL2 Complete!");
            return true;
        }
    }, 2000);
}

function qcall1a() {
    return new Promise( async (resolve,reject) => {
        await qcall2();
        setTimeout((err) => {
            if(err) {
                console.log("ERROR: QCALL1(): " + err);
                reject(false);
                //return false;
            } else {
                console.log("QCALL1 Complete!");
                resolve(true);
                //return true;
            }
        }, 1000);
    });
}

async function qcall1() {
    await qcall2();
    setTimeout((err) => {
        if(err) {
            console.log("ERROR: QCALL1(): " + err);
            throw new Error("ERROR: QCALL1(): " + err);
        } else {
            console.log("QCALL1 Complete!");
            return true;
        }
    }, 1000);
}
async function go() {
        console.log("Begin DEBUGGER await call...");
        await qcall3();
        console.log("DEBUGGER mid point");
        await qcall1();
        console.log("End DEBUGGER await call.");
        return('done.');
}


go().then(v => console.log(v))
    .catch(err => console.error(err));;
console.log("here6789");



/*
async function getResponse() {
      setTimeout(function() {
        return "Response from API. Executed after 5 secs";
      }, 5000);
  }

  function getResponse2() {
    return new Promise(function(resolve, reject) {
      setTimeout(function() {
        resolve("Response from API. Executed after 5 secs");
      }, 5000);
    });
  }
  
  async function hello() {
    let response = await getResponse2();
    console.log("here in hello()");
    return response;
  }
  
  hello()
    .then(function(x) {
      console.log(x);
    })
    .catch(function(x) {
      console.log(x);
    });
  console.log("Im executed before getResponse()");
  */