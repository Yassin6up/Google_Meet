const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { ExpressPeerServer } = require('peer');
const  { PrismaClient } = require('@prisma/client') 
// Initialize the database connection
const prisma = new PrismaClient()

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const peerServer = ExpressPeerServer(server, {
  debug: true,
});

app.set('view engine', 'ejs');
app.use('/peerjs', peerServer);
app.use(express.static('public'));
let users = []
let roomID  ;

io.on('connection',  socket=>{
    console.log("connection")
    socket.on("create_room", async (data)=>{
        console.log("create room : " , data)
        try{
            await prisma.room.create({
                data:{
                    title: data.title,
                    owner: data.name,
                    code : data.code
                    },
            })
            
            socket.emit('createRoom',{owner : data.name , code : data.code})
        }catch{
            console.log("error in creating room or redirect to room")
        }
    })

    socket.on('message',async (data)=>{
        const room = await prisma.room.findUnique({
            where:{
                code : data.code
            }
        })

        if(!room){
            socket.emit('no room')
            return ;
        }

        io.to(room.code).emit('messageReturn' , {message : room.title , roomId : room.code})

    })
socket.on("leaveRoom",(data)=>{
    
    socket.leave(data.code)
    console.log('in room : ' , io.socketsJoin(data.code))
})

    socket.on("join_room",async (data)=>{
        console.log('join room :' , data)
        const room = await prisma.room.findUnique({
            where:{
                code : data.roomCode
            }
        })
        if(room){
            socket.emit('joinRoom',{title : room.title , code : room.code})
            io.to(room.code).emit("needJoin" , {name : data.name})
        }else{
            console.log("room not found")
        }
    })
})



app.get('/room=:id', async (req, res) => {
    const {id} = req.params
    const room = await prisma.room.findUnique({
        where  :{
            code : id
        }
    })
    
    if(!room){
        res.send(`no room with this id :${id} <br>
        <a href='/'>
        <button>Go Back 🎈</button>
        </a>
        `)
        return ;
    }
    io.on('connection',socket=>{
        socket.join(room.code)
    })
    

    roomID = room.code

    res.render('room' , {title : room.title , owner:room.owner });
});



app.get('/', (req, res) => {

  

    res.render('index');

});





io.on("message",(message)=>{
    console.log(message)
})



io.on("request",(req)=>{
    const connection = req.accept() 
    console.log(connection)
    connection.on("message",(data)=>{
        let message = JSON.parse(data.utf8Data)
        console.log(message)
        switch(message){
            case "store_user":{
                if(!users.includes(message.username)){
                    users.push({conn: connection , name:message.username})
                    console.log(users)
                    broadcastUserConnected(message.username)
                    }else{
                        alert(`${message.username} is already connected`)
                        }
                        break;
                        }
                        function broadcastUserConnected(userName){
                            io.emit("BROADCAST_USERS",users)
                            }
                        
        }
    })
})

io.on('connection', (socket) => {
    socket.on('join-room', (data) => {
      socket.to(socket.id).emit('peer-signal', data);
    });
  });
  

server.listen(3000, () => {
  console.log('Server is running on port 3000');
});
