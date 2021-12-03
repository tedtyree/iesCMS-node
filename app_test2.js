console.log("START:");

function qcall3() {
    return new Promise((resolve,reject) => {
        setTimeout((err) => {
                console.log("QCALL3 Complete!");
                resolve(true);
        }, 3000);
    });
}

async function qcall2() {
    try {
        await qcall3();
        setTimeout((err) => {
                console.log("QCALL2 Complete!");
                return true;
        }, 2000);
    } catch { }
}

async function qcall1() {
    try {
        await qcall2();
        setTimeout((err) => {
                console.log("QCALL1 Complete!");
                return true;
        }, 1000);
    } catch { }
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
    .catch(err => console.error(err));

console.log("END.");

