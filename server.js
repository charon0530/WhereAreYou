//모듈 추출
var https = require('https');
var express = require('express');
var bodyParser = require('body-parser');
var fs = require('fs');
var mysql = require('mysql');
var crypto = require('crypto');

var client = mysql.createConnection({
    user: 'root',
    password: 'root',
    database: 'Project'
})

var key_options = {
    key: fs.readFileSync('private.pem','utf8'),
    cert: fs.readFileSync('public.pem','utf8'),
}
//변수
var user_count = 0;
var locations = [];
   

function degreesToRadians(degrees) {
    radians = (degrees * Math.PI) / 180;
    return radians;
}
function computeDistance(start_lat, start_lan, dest_lat, dest_lan) {
    var startLatRads = degreesToRadians(start_lat);
    var startLongRads = degreesToRadians(start_lan);
    var destLatRads = degreesToRadians(dest_lat);
    var destLongRads = degreesToRadians(dest_lan);

    var Radius = 6371; //지구의 반경(km)
    var distance = Math.acos(Math.sin(startLatRads) * Math.sin(destLatRads) +
                    Math.cos(startLatRads) * Math.cos(destLatRads) *
                    Math.cos(startLongRads - destLongRads)) * Radius;
    return distance;
}
//웹 서버 생성
var app = express();
app.use(express.static('public'))
app.use(bodyParser.urlencoded({ extended: false }));

//요청 처리
app.get('/user_count', function (req, res) {
    res.send(String(user_count));
});
app.get('/locations/:i', function (req, res) {
    var i = Number(req.params.i);
    res.send(locations[i])
});
app.get('/location/:id', function (req, res) {
    var id = req.params.id;
    var message;
    var check = false;
    var index;
    for (var i = 0; i < locations.length; i++) {
        if (id == locations[i].ID) {
            index = i;
            check = true;
        }
    }

        if (check) {
            res.send(locations[index]);
        }
        else {
            res.send("해당 id가 접속중이지 않습니다.")
        }
});
app.get('/walk_distance/:id', function (req, res) {
    var id = req.params.id;
    var message;
    var index;
    
    for (var i = 0; i < locations.length; i++) {
        if (id == locations[i].ID) {
            index = i;
            console.log(locations[index].WALK_DISTANCE)
            message = 'ID : ' + locations[index].ID + '\n' + '총 이동거리 : ' + Number(locations[index].WALK_DISTANCE);
            res.send(message);
        }
        else {
            message = '이동거리 출력 오류';
            res.send(message);
        }
    }

});
app.get('/show_ranking', function (req, res) {
    var output = ''
    client.query('SELECT * FROM ranking', function (err, result, fields) {
        if (err) {
            console.log(err);
        }
        else {
            result.sort(function (a, b) {
                return b.distance - a.distance;
            });
            for (var i=0; i < result.length; i++) {
                output += i+1 + '등 : ' + result[i].id + ' 이동거리 : ' + result[i].distance + ' km\n';
            }
            console.log(output);
            res.send(output);
        }
    })
});
app.post('/regist', function (req, res) {
    var check = false;//false 는 중복 X
    var name = req.body.user_name;
    var id = req.body.user_id;
    var pw = req.body.user_pass;
    var message = 'DEFAULT MESSAGE'
    client.query('SELECT * FROM user', function (err, result, fields) {
        if (err) {
            console.log(err);
        }
        else {
            for (var i = 0; i < result.length; i++) {
                if (id == result[i].id) {
                    check = true;
                }
            }
            if (check == true) {
                message = '아이디가 중복되었습니다.'
                res.send(message);
            }
            else {
                client.query('INSERT INTO user VALUES(?,?,sha2(?,256))', [id, name, pw], function (err, data) {
                    console.log(err);
                });
                console.log('name: '+ name + '/' + 'id: '+ id + ' / ' + 'pw: ' + pw + ' 회원가입');
                message = '회원가입 완료'
                res.send(message);
            }
        }
    })
})
app.post('/login', function (req, res) {
    var check = false;//true 로그인 성공
    var id = req.body.user_id;
    var pw = req.body.user_pass;
    var enc_pw = crypto.createHash('sha256').update(pw).digest('hex');
    var sendObject ={
        message: '',
        c_id: ''
    }
    client.query('SELECT * FROM user', function (err, result, fields) {
        if (err) {
            console.log(err);
        }
        else {
            for (var i = 0; i < result.length; i++) {
                if (id == result[i].id && enc_pw==result[i].pw) {
                    check = true;
                }
            }
            if (check == false) {
                sendObject.message = '아이디 또는 패스워드가 틀립니다.'
                res.send(sendObject);
            }
            else {
                console.log('id : '+id + '로그인');
                //쿠키 생성
                sendObject.message = '로그인 성공';
                sendObject.c_id = id;
                res.send(sendObject);
            }
        }
    })
})
app.post('/reg_ranking', function (req, res) {
    var id = req.body.client_id;
    var distance = req.body.walk_distance;
    console.log('test')
    client.query('INSERT INTO ranking VALUES(?,?)', [id, distance], function (err, data) {
        console.log(err);
    });
    console.log('id: ' + id +' / ' + 'distance: ' + distance + ' 랭킹등록');
    message = '랭킹등록 성공'
    res.send(message);
});
app.post('/location/:id', function (req, res) {
    var i = 0;
    var check_id = false; // false 중복 X true 중복 O
    var id = req.params.id;
    var lat = req.body.client_lat;
    var lan = req.body.client_lan;
    for (i = 0 ; i < locations.length; i++) {
        if (id == locations[i].ID) { check_id = true; }
    }

    if (check_id == false) {
        var location = {
            ID: id,
            LAT: lat,
            LAN: lan
        }
        locations.push(location);
        user_count++;
        res.send('정상작동');
    }
    else {
        res.send('아이디가 중복되었습니다.');
    }
});
app.put('/location/:id', function (req, res) {
    var id = req.params.id;
    var lat = req.body.client_lat;
    var lan = req.body.client_lan;
    for (var i = 0; i < locations.length; i++) {
        if (id == locations[i].ID) {
            locations[i].LAT = lat;
            locations[i].LAN = lan;
        }
    }
    res.send();
});
app.delete('/location/:id', function (req, res) {
    var id = req.params.id;
    var message = '다시 시도해주세요';
    for (var index = 0; index < locations.length; index++) {
        (function (index) {
            if (id == locations[index].ID) {
                locations.splice(index, 1);
                user_count--;
                message = '정상종료 되었습니다.';
            }
            else { }
        })(index);
    }
    res.send(message);
});

//app.listen(80, function (req,res) {
//   console.log("http server running")
//})

var https_server = https.createServer(key_options, app);
var io = require('socket.io')(https_server);
io.on('connection', function (socket) {
    socket.on('send_cId',function(client_id){
        console.log('user connected: ', socket.id);  
        var name = client_id;
        var msg = name+'님이 접속하였습니다.';
        io.to(socket.id).emit('change name', name);   
        io.emit('receive message',msg)
    })

    socket.on('before_exit', function (client_id) {
        var name = client_id;
        var msg = name + '님이 접속을 종료하였습니다.';
        io.emit('receive message', msg)

    })

    socket.on('disconnect', function () {
        console.log('user disconnected: ', socket.id);
    });

    socket.on('send message', function (name, text) {
        var msg = name + ' : ' + text;
        console.log(msg);
        io.emit('receive message', msg);
    });
});


https_server.listen(443, function () {
    console.log("https server, socket.io running");
})
