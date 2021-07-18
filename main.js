const Discord = require("discord.js");
const { prefix, token } = require("./config.json");
const lan = require("./text.json")
const ytdl = require("ytdl-core");
const client = new Discord.Client();
const queue = new Map();
var youtubesearchapi=require('youtube-search-api');
/*
const http = require('http');
const port = process.env.PORT || 3000
const server = http.createServer((req, res) => {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html');
  res.end('<h1>Hello World</h1>');
}); 
server.listen(port,() => {
  console.log(`Server running at port `+port);
});
*/
client.once("ready", () => {
  connect()
  console.log("智乃音樂機器人啟動成功!  User:"+client.user.username);
  setInterval(() => {
    process.exit(0);
  }, 259200000);
});

var WebSocketClient = require('websocket').client;

/*
    const queueContruct = {
      textChannel: message.channel,
      voiceChannel: voiceChannel,
      connection: null,
      dj: message.author,
      busy: false,
      songs: [],
      skips: 1,
      skiplist: [],
      volume: 5,
      loop: false,
      playing: true
    }
*/
var clientws = new WebSocketClient();
clientws.on('connectFailed', function(error) {
  console.log('Connect Error: ' + error.toString());
  setTimeout(() => {
    connect() 
  }, 10000);
});
clientws.on('connect', ws => {
  ws.addListener('message',async datas => {
    let data = JSON.parse(datas.utf8Data)
    if(data.type === "text") {
    console.log(data.message)
  }else if(data.type === "command") {
    if(data.cmd === "getList") {
    let serverQueue = queue.get(data.id)
    if(!serverQueue) return ws.send(JSON.stringify({list: undefined}))
    let gui = client.guilds.cache.get(data.id)
    let guild = {id: gui.id,name: gui.name,iconURL: gui.iconURL({size: 1024,dynamic: true})}
    let seek = (serverQueue.connection.dispatcher.streamTime - serverQueue.connection.dispatcher.pausedTime) / 1000;
    let song = {song: serverQueue.songs[0],guild: guild, dj: serverQueue.dj,seek: seek,playing: serverQueue.playing,loop: serverQueue.loop,volume: serverQueue.volume}
      ws.send(JSON.stringify({list: song,id: data.id}))
    }else if(data.cmd === "pause") {
      let serverQueue = queue.get(data.id)
      let acc = await Webdjperm(data.dj,data.id)
      if(acc === false) return ws.send(JSON.stringify({type:"Runcommand",ok:false,Error: "No_permission",message: "你無法暫停和播放音樂."}))
        if(serverQueue.playing) {
        serverQueue.connection.dispatcher.pause()
        serverQueue.playing = false
        let text = client.channels.cache.get(serverQueue.textChannel.id)
        text.send("[線上操作] "+lan.zh_TW.pause.pause)
        ws.send(JSON.stringify({type:"Runcommand",ok:true,message: "已暫停!"}))
        }else{
          serverQueue.connection.dispatcher.resume()
          serverQueue.playing = true
          let text = client.channels.cache.get(serverQueue.textChannel.id)
          text.send("[線上操作] "+lan.zh_TW.play.play)
          ws.send(JSON.stringify({type:"Runcommand",ok:true,message: "開始播放!"}))
      }
    }else if(data.cmd === "skip") {
      let serverQueue = queue.get(data.id)
      let acc = await Webdjperm(data.dj,data.id)
      if(acc === false) return ws.send(JSON.stringify({type:"Runcommand",ok:false,Error: "No_permission",message: "你無法跳過音樂."}))
      serverQueue.connection.dispatcher.end();
      let text = client.channels.cache.get(serverQueue.textChannel.id)
      text.send("[線上操作] "+lan.zh_TW.skip.skip)
      ws.send(JSON.stringify({type:"Runcommand",ok:true,message: "已跳過歌曲."}))
    }else if(data.cmd === "loop") {
      let serverQueue = queue.get(data.id)
      let acc = await Webdjperm(data.dj,data.id),loop = data.loop
      if(acc === false) return ws.send(JSON.stringify({type:"Runcommand",ok:false,Error: "No_permission",message: "你無法切換循環模式."}))
      serverQueue.loop = loop
      let text = client.channels.cache.get(serverQueue.textChannel.id)
      if(data.loop === "single") {
        text.send("[線上操作] "+lan.zh_TW.loop.set+lan.zh_TW.loop.single)
        ws.send(JSON.stringify({type:"Runcommand",ok:true,message: "已設定為單首播放!"}))
    }else if(data.loop === "all") {
      text.send("[線上操作] "+lan.zh_TW.loop.set+lan.zh_TW.loop.all)
      ws.send(JSON.stringify({type:"Runcommand",ok:true,message: "已設定為清單全部播放!"}))
    }else if(data.loop === false) {
      text.send("[線上操作] "+lan.zh_TW.loop.set+ lan.zh_TW.loop.off)
      ws.send(JSON.stringify({type:"Runcommand",ok:true,message: "已關閉重複播放!"}))
    }
    }else if(data.cmd === "addsong") {
      let serverQueue = queue.get(data.id),content = data.loop
      let text = client.channels.cache.get(serverQueue.textChannel.id)
      let user = client.users.cache.get(data.dj)
      let message = {author: user}
      content = decodeURIComponent(content);let songlist = new Array()
      if(content == null || content == "")  return ws.send(JSON.stringify({type:"Runcommand",ok:false,message: "請填入網址或關鍵字!"}))
      var songInfo = null,song = null;var urlRegex = /(https?:\/\/[^\s]+)/g;
      if(urlRegex.test(content)) {
        let url = new URL(content)
        if(url.hostname === "www.youtube.com" || url.hostname === "youtu.be" || url.hostname === "youtube.com") {
        if(serverQueue) {
        if(serverQueue.busy === true) return ws.send(JSON.stringify({type:"Runcommand",ok:false,Error: "No_permission",message: "伺服器忙碌中<br>請稍後!"}));
        serverQueue.busy = true}
        if(url.searchParams.has("list")) {
        let plist= url.searchParams.get("list")
        let list2= null;
        try{
        list2 = await youtubesearchapi.GetPlaylistData(plist)
        }catch{
          list2 = false
        }
        if(list2 === null || list2 === false) return ws.send(JSON.stringify({type:"Runcommand",ok:false,Error: "No_permission",message: "此歌單找不到歌曲"}))
          let list = list2.items
          let loadnum = 0
          list = Object.keys(list).map((key) => [list[key]]);
          for(songs of list) {
            songs = songs[0]
            songInfo = await ytdl.getInfo("https://www.youtube.com/watch?v="+songs.id);
            song = {
              title: songInfo.videoDetails.title,
              url: songInfo.videoDetails.video_url,
              author: {name: songInfo.videoDetails.author.name,avatar: songInfo.videoDetails.author.thumbnails[0].url,url: songInfo.videoDetails.author.channel_url},
              time: songInfo.videoDetails.lengthSeconds,
              order: message,
              thumbnail: `https://img.youtube.com/vi/${songInfo.videoDetails.videoId}/maxresdefault.jpg`};
            songlist.push(song)
            loadnum++
          }
          return ws.send(JSON.stringify({type:"Runcommand",ok:true,Error: "No_permission",message: lan.zh_TW.play.loadlist+` [${loadnum}/${list.length}] [${lan.zh_TW.play.done}]`}))
        }else{
        songInfo = await ytdl.getInfo(content);
        song = {
          title: songInfo.videoDetails.title,
          url: songInfo.videoDetails.video_url,
          author: {name: songInfo.videoDetails.author.name,avatar: songInfo.videoDetails.author.thumbnails[0].url,url: songInfo.videoDetails.author.channel_url},
          time: songInfo.videoDetails.lengthSeconds,
          order: message,
          thumbnail: `https://img.youtube.com/vi/${songInfo.videoDetails.videoId}/maxresdefault.jpg`};}
      }else{return ws.send(JSON.stringify({type:"Runcommand",ok:false,Error: "No_permission",message: lan.zh_TW.play.noyturl}))}
    }else{
      if(serverQueue) {
        if(serverQueue.busy === true) return ws.send(JSON.stringify({type:"Runcommand",ok:false,Error: "No_permission",message: "伺服器忙碌中<br>請稍後!"}));
        serverQueue.busy = true}
        let id = null
        try{
        id = await youtubesearchapi.GetListByKeyword(text)
        }catch{return ws.send(JSON.stringify({type:"Runcommand",ok:false,Error: "Seach_error",message: "尋找歌曲發生錯誤!"}))};
        try{
        songInfo= await ytdl.getInfo("https://www.youtube.com/watch?v="+id.items[0].id);
        }catch{return ws.send(JSON.stringify({type:"Runcommand",ok:false,Error: "Seach_error2",message: "尋找歌曲發生錯誤!"}))}
        song = {
          title: songInfo.videoDetails.title,
          author: {name: songInfo.videoDetails.author.name,avatar: songInfo.videoDetails.author.thumbnails[0].url,url: songInfo.videoDetails.author.channel_url},
          url: songInfo.videoDetails.video_url,
          time: songInfo.videoDetails.lengthSeconds,
          order: message,
          thumbnail: `https://img.youtube.com/vi/${songInfo.videoDetails.videoId}/maxresdefault.jpg`};
      }
      serverQueue.busy = false
      if(songlist.length != 0) {
        for (const songl of songlist) {serverQueue.songs.push(songl);}        
        ws.send(JSON.stringify({type:"Runcommand",ok:true,message: `${lan.zh_TW.play.list} ${songlist.length} ${lan.zh_TW.play.list2}`}))
        text.send(`[線上新增] ${lan.zh_TW.play.list} ${songlist.length} ${lan.zh_TW.play.list2}`)
      }else{
        serverQueue.songs.push(song);
      let timeshow = `${Math.floor(song.time/60)}:${(song.time - Math.floor(song.time/60)*60) -1}`
      let playembed = new Discord.MessageEmbed().setTitle(`[線上新增] ${lan.zh_TW.play.add_song}`).setDescription(`[${song.title}](${song.url})`).setAuthor(`${song.author.name}`,song.author.avatar,song.author.url)
      .addField(lan.zh_TW.play.long,timeshow).setColor("#49a8ff").setTimestamp().setThumbnail(song.thumbnail).setFooter(lan.zh_TW.play.order + song.order.author.username,"https://cdn.discordapp.com/avatars/"+song.order.author.id+"/"+song.order.author.avatar)
      ws.send(JSON.stringify({type:"Runcommand",ok:true,message: "🔻已新增 "+song.title}))
      return text.send(playembed);
    }}
  }
  })
})

function Webdjperm(userID = String,serverID= String) {
  let serverQueue = queue.get(serverID),member = null
  try{
  member = client.guilds.cache.get(serverID).members.cache.get(userID)
  }catch{
    client.guilds.cache.get(serverID).members.fetch(userID).then((User) => {
      member = User
    })
  }
  let guild = client.guilds.cache.get(serverID)
  if(!serverQueue) return "none";
  if (member.hasPermission(['ADMINISTRATOR'])) {
    return true;
  }else if(serverQueue.dj.id === userID) {
    return true;
  }else if(message.guild.owner) {
    if(guild.owner.id === userID) {return true;}
    else{ return false;}
  }else{
    return false;}
}

clientws.on('connect', function(connection) {
  console.log('WebSocket Client Connected');
  connection.on('error', function(error) {
      console.log("Connection Error: " + error.toString());
      setTimeout(() => {
        connect() 
      }, 5000);
  });
});

function connect() {
  clientws.connect('ws://localhost:4434/musicbot',"BOT")
}

client.once("reconnecting", () => {
  console.log("Reconnecting!");
});

client.once("disconnect", () => {
  console.log("Disconnect!");
});

let cooldown = new Set(),channelcooldown = new Set();

async function cooldownclear(message) {
  setTimeout(() => {
    cooldown.delete(message.author.id)
  }, 2000);
  setTimeout(() => {
    channelcooldown.delete(message.channel.id)
  }, 500);
}

client.on("message", async message => {
  let l = lan.zh_TW
  if (message.author.bot) return;
  if (!message.content.startsWith(prefix)) return;
  if(!message.guild) return;
  if (!message.member.guild.me.hasPermission(['SEND_MESSAGES'])) return;
  if(cooldown.has(message.author.id)) return message.channel.send(l.word.cooldown)
  if(channelcooldown.has(message.channel.id)) return;
  cooldownclear(message);
  cooldown.add(message.author.id)
  channelcooldown.add(message.channel.id)
  const serverQueue = queue.get(message.guild.id);
  let text = message.content.split(" ")[0]
  if (text === `${prefix}play` || text ===`${prefix}p`) {
    execute(message, serverQueue);
    return;
  } else if (text ===`${prefix}shuffle` || text ===`${prefix}sf`  || text ===`${prefix}random`) {
    let acc = await djperm(message,serverQueue)
    if(acc === false) return message.channel.send(l.word.nodj)
    shuffle(message, serverQueue);
    return;
  } else if (text === `${prefix}skip` || text ===`${prefix}s`) {
    skip(message, serverQueue);
    return;
  } else if (text === `${prefix}queue` || text === `${prefix}q`) {
    queues(message, serverQueue);
    return;
  } else if (text === `${prefix}remove` || text === `${prefix}re`) {
    remove(message, serverQueue);
    return;
  } else if (text === `${prefix}nowplaying` || text === `${prefix}np`) {
    nowplaying(message, serverQueue);
    return;
  } else if (text === `${prefix}loop` || text === `${prefix}lp`) {
    let acc = await djperm(message,serverQueue)
    if(acc === false) return message.channel.send(l.word.nodj)
    loop(message, serverQueue);
    return;
  } else if (text === `${prefix}vol` || text === `${prefix}volume`) {
    let acc = await djperm(message,serverQueue)
    if(acc === false) return message.channel.send(l.word.nodj)
    volume(message, serverQueue);
    return;
  } else if (text === `${prefix}skipto` || text === `${prefix}st`) {
    let acc = await djperm(message,serverQueue)
    if(acc === false) return message.channel.send(l.word.nodj)
    skipto(message, serverQueue);
    return;
  } else if (text === `${prefix}pause`) {
    let acc = await djperm(message,serverQueue)
    if(acc === false) return message.channel.send(l.word.nodj)
    pause(message, serverQueue);
    return;
  } else if (text=== `${prefix}stop` || text=== `${prefix}dc` || text === `${prefix}leave`) {
    let acc = await djperm(message,serverQueue)
    if(acc === false) return message.channel.send(l.word.nodj)
    stop(message, serverQueue);
    return;
  } else if (text === `${prefix}music-ping` || text === `${prefix}m-ping`) {
    ping(message, serverQueue);
    return;
  } else if (text === `${prefix}about` || text === `${prefix}status`) {
    status(message, serverQueue);
    return;
  } else if (text === `${prefix}m-close` || text === `${prefix}music-close`) {
    close(message, serverQueue);
    return;
  }
});

function close(message,serverQueue) {
  if (message.author.id !== '546144403958398988') return;
  message.channel.send("🛑重啟音樂機器人中...").then(() => {
    process.exit(0);})
}

function djperm(message,serverQueue) {
  if(!serverQueue) return "none";
  if (message.member.hasPermission(['ADMINISTRATOR'])) {
    return true;
  }else if(serverQueue.dj.id === message.author.id) {
    return true;
  }else if(message.guild.owner) {
    if(message.guild.owner.id === message.author.id) {return true;}
    else{ return false;}
  }else{
    return false;}
}

function ping(message,serverQueue) {
  let time = new Date()
  let l = lan.zh_TW
  if(message.author.bot) return;
message.channel.send("pong!").then(( lastMessage) => {
  let time2 = new Date()
  let time3 = (time2.getUTCMilliseconds() - time.getUTCMilliseconds())
  if(lastMessage.content === `pong!`) {
    lastMessage.edit("pong!!").then((editmessage) => {
      let time4 = new Date();let time5 = (time4.getUTCMilliseconds() - time2.getUTCMilliseconds())
    {return message.channel.send(l.ping.chino + (Math.round((lastMessage.createdAt - message.createdAt)) + ' ms\n\n'+l.ping.message +': '+ time3 +' ms\n'+l.ping.edit+': '+ time5 +" ms" ))};}
    )}
    }
)}
const Open = new Date()
function status(message,serverQueue) {
  let l = lan.zh_TW
  let Today=new Date();
  let day = (Today.getDate() - Open.getDate())
  if(Today.getHours() - Open.getHours() <0 || Today.getHours() - Open.getHours() != 0) {day -1;var hour = 24 - (Today.getHours() - Open.getHours())}else{var hour = (Today.getHours() - Open.getHours())}
 let statusembed = new Discord.MessageEmbed()
 .setTitle(l.status.title).setDescription(l.status.desc).setColor("#3694ee").setAuthor(`${client.user.username}#${client.user.discriminator}`,client.user.displayAvatarURL())
 .addField(l.status.prefix, prefix ,true)
 .addField(l.status.version, `Music(1.0.0)` ,true)
 .addField(l.status.from, "JS(JavaScript) / Discord.js / @discord.js/opus")
 .addField(l.status.from_version+" Node.js/discord.js/", "14.16.0(win7 32bit) / 12.5.1 / 0.5.0")
 .addField(l.status.time,day+l.date.day +hour+ l.date.h + (Today.getMinutes() - Open.getMinutes()) + l.date.m)
 .addField(l.status.playing,queue.size)
 message.channel.send(statusembed)
}

async function execute(message, serverQueue) {
  const args = message.content.split(" ");
  let l = lan.zh_TW
  const voiceChannel = message.member.voice.channel;
  if (!voiceChannel)
    return message.channel.send(l.play.No_join);
  const permissions = voiceChannel.permissionsFor(message.client.user);
  if (!permissions.has("CONNECT") || !permissions.has("SPEAK")) {
    return message.channel.send(l.play.No_prem);
  }
  if(serverQueue) {
  if(serverQueue.playing === false) {
    serverQueue.connection.dispatcher.resume()
    serverQueue.playing = true
    message.channel.send(l.play.play)
    return;
  }}
  let songlist = new Array()
  if(args[1] == null || args[1] == "")  return message.channel.send(l.play.No_type);
  var songInfo = null,song = null;
  var urlRegex = /(https?:\/\/[^\s]+)/g;
  if(urlRegex.test(args[1])) {
    let url = new URL(args[1])
    if(url.hostname === "www.youtube.com" || url.hostname === "youtu.be" || url.hostname === "youtube.com") {
    if(serverQueue) {
    if(serverQueue.busy === true) return message.channel.send(l.play.busy)
    serverQueue.busy = true
    }
    if(url.searchParams.has("list")) {
    let plist= url.searchParams.get("list")
    let list2= null;
    try{
    list2 = await youtubesearchapi.GetPlaylistData(plist)
    }catch{
      list2 = false
    }
    if(list2 === null || list2 === false) return message.channel.send(l.play.nolist)
    let load = await message.channel.send(l.play.loadlist)
      let list = list2.items
      let loadnum = 0
      list = Object.keys(list).map((key) => [list[key]]);
      let loads = setInterval(() => {
        load.edit(l.play.loadlist+` [${loadnum}/${list.length}]`)
      }, 1500); 
      for(songs of list) {
        songs = songs[0]
        songInfo = await ytdl.getInfo("https://www.youtube.com/watch?v="+songs.id);
        song = {
          title: songInfo.videoDetails.title,
          url: songInfo.videoDetails.video_url,
          author: {name: songInfo.videoDetails.author.name,avatar: songInfo.videoDetails.author.thumbnails[0].url,url: songInfo.videoDetails.author.channel_url},
          time: songInfo.videoDetails.lengthSeconds,
          order: message,
          thumbnail: `https://img.youtube.com/vi/${songInfo.videoDetails.videoId}/maxresdefault.jpg`};
        songlist.push(song)
        loadnum++
      }
      await message.channel.send(`${l.play.list} ${list.length} ${l.play.list2}`)
      clearInterval(loads);
      load.edit(l.play.loadlist+` [${loadnum}/${list.length}] [${l.play.done}]`)
    }else{
    songInfo = await ytdl.getInfo(args[1]);
    song = {
      title: songInfo.videoDetails.title,
      url: songInfo.videoDetails.video_url,
      author: {name: songInfo.videoDetails.author.name,avatar: songInfo.videoDetails.author.thumbnails[0].url,url: songInfo.videoDetails.author.channel_url},
      time: songInfo.videoDetails.lengthSeconds,
      order: message,
      thumbnail: `https://img.youtube.com/vi/${songInfo.videoDetails.videoId}/maxresdefault.jpg`};
    }
  }else{return message.channel.send(l.play.noyturl)}
}else{
  if(serverQueue) {
    if(serverQueue.busy === true) return message.channel.send(l.play.busy) 
    serverQueue.busy = true
    }
    let text = message.content.replace(prefix,""),secuss = false
    let id = null;
    try{
    id = await youtubesearchapi.GetListByKeyword(text)
    }catch{return message.channel.send(l.play.word_error)};
    try{
    songInfo= await ytdl.getInfo("https://www.youtube.com/watch?v="+id.items[0].id);
    }catch{return message.channel.send(l.play.word_error)}
    song = {
      title: songInfo.videoDetails.title,
      author: {name: songInfo.videoDetails.author.name,avatar: songInfo.videoDetails.author.thumbnails[0].url,url: songInfo.videoDetails.author.channel_url},
      url: songInfo.videoDetails.video_url,
      time: songInfo.videoDetails.lengthSeconds,
      order: message,
      thumbnail: `https://img.youtube.com/vi/${songInfo.videoDetails.videoId}/maxresdefault.jpg`};
  }
  if (!serverQueue) {
    const queueContruct = {
      textChannel: message.channel,
      messageID: null,
      voiceChannel: voiceChannel,
      connection: null,
      dj: message.author,
      busy: false,
      songs: [],
      skips: 1,
      skiplist: [],
      volume: 5,
      loop: false,
      playing: true
    }
    queue.set(message.guild.id, queueContruct);
    if(songlist.length != 0) {
      for (const songl2 of songlist) {
        queueContruct.songs.push(songl2);
      }
    }else{
      queueContruct.songs.push(song);
    }
      try {
      var connection = await voiceChannel.join();
      queueContruct.connection = connection;
      play(message.guild, queueContruct.songs[0]);
    } catch (err) {
      console.log(err);
      queue.delete(message.guild.id);
      return message.channel.send(err);
    }
  } else {
    serverQueue.busy = false
    if(songlist.length != 0) {
      for (const songl1 of songlist) {
        serverQueue.songs.push(songl1);
      }
    }else{
      serverQueue.songs.push(song);
    let timeshow = `${Math.floor(song.time/60)}:${(song.time - Math.floor(song.time/60)*60) -1}`
    let playembed = new Discord.MessageEmbed().setTitle(`${l.play.add_song}`).setDescription(`[${song.title}](${song.url})`).setAuthor(`${song.author.name}`,song.author.avatar,song.author.url)
    .addField(l.play.long,timeshow).setColor("#49a8ff").setTimestamp().setThumbnail(song.thumbnail).setFooter(l.play.order + song.order.author.username,"https://cdn.discordapp.com/avatars/"+song.order.author.id+"/"+song.order.author.avatar)
    return message.channel.send(playembed);
  }
  }
}

async function skip(message, serverQueue) {
  let l = lan.zh_TW
  if (!message.member.voice.channel)
    return message.channel.send(l.skip.No_join)
  if (!serverQueue)
    return message.channel.send(l.skip.No_song);
    let acc = await djperm(message,serverQueue)
    if(acc === false) {
      let voice = message.member.voice.channel.members.size,num = 1
      if(voice === 1) {num = 0}else if(voice <= 5) {num = 2}else if(voice <= 8) {num = 5}else if(voice <= 10) {num = 7}else{num = 10}
      if(serverQueue.skiplist.indexOf(message.author.id) != -1) return message.channel.send(l.skip.skiphas)
      if(serverQueue.skips >= num) {
        serverQueue.connection.dispatcher.end();
        message.channel.send(l.skip.skip)
      }else{
        serverQueue.skips = serverQueue.skips+1
        serverQueue.skiplist.push(message.author.id)
        message.channel.send(message.author.username+l.skip.skipadd+` (${serverQueue.skips-1}/${num})`)
      }
    }else{
  serverQueue.connection.dispatcher.end();
  message.channel.send(l.skip.skip)
    }
}

function skipto(message, serverQueue) {
  let l = lan.zh_TW
  if (!message.member.voice.channel)
    return message.channel.send(l.skip.No_join)
  if (!serverQueue)
    return message.channel.send(l.skip.No_song);
    const args = message.content.split(" ");
    if(isNaN(args[1])) return message.channel.send(l.remove.isNAN)
    let num = parseInt(args[1])
    num = num-1
    serverQueue.songs.splice(1,num)
  serverQueue.connection.dispatcher.end();
  message.channel.send(l.skip.skipto+args[1]+l.skip.skipto2)
}

function queues(message, serverQueue) {
  let l = lan.zh_TW
  if (!message.member.voice.channel)
    return message.channel.send(l.queue.No_join)
  if (!serverQueue)
    return message.channel.send(l.stop.No_song);
    let list = Object.keys(serverQueue.songs).map((key) => [serverQueue.songs[key]]);
    let show = "",num = 0,next = new Array(),nowpage=0
    for(let songs of list) {
      num++
      songs = songs[0]
      if(num === 1) {
        show = `${num}. [${songs.title}](${songs.url})`
      }else{
        let num2 = Math.ceil(num/10)
        if(!next[num2-1]) {
          next.push([])
        }
        next[num2-1].push(`${num}. [${songs.title}](${songs.url})`)
      }
    }
    setTimeout(() => {
      let nums = 1,dec = "　　"
    if(next[0]) {
    nums = (next[0].length)+1
    dec= next[0].join("\n")
  }
    let embed = new Discord.MessageEmbed().setTitle(l.queue.list).setDescription(`[${l.queue.now}] ${show} \n\n${dec}`) 
    .setFooter(`[${nums}/${num}]`)
      message.channel.send(embed).then((im) => {
        if(num > 10) {
        if(next[0]) {
        im.react("◀");
        im.react("▶");
        read(im)}
        }
      })
    }, 1000);
    function read(im) {      
      let nums = (next[nowpage].length)+((nowpage)*10)
      if(num != nums) nums++
      let embed = new Discord.MessageEmbed().setTitle(l.queue.list).setDescription(`[${l.queue.now}] ${show} \n\n${next[nowpage].join("\n")}`) 
      .setFooter(`[${nums}/${num}]`)
      im.edit(embed)
      if(nowpage === 0) {
        var filter = (reaction, user) => {
             return ['▶'].includes(reaction.emoji.name) && user.id === message.author.id;};
     }else if(nums === num) {
        var filter = (reaction, user) => {
             return ['◀'].includes(reaction.emoji.name) && user.id === message.author.id;};
    }else{
      var filter = (reaction, user) => {
           return ['◀','▶'].includes(reaction.emoji.name) && user.id === message.author.id;};
   }
   im.awaitReactions(filter, { max: 1, time: 15000, errors: ['time'] })
   .then(collected => {
           const reaction = collected.first();
           if (reaction.emoji.name == "◀") {
              nowpage= nowpage-1
               reaction.users.remove(message.author)
               read(im)
           }else if(reaction.emoji.name == "▶") {
               nowpage++
               reaction.users.remove(message.author)
               read(im)
           }
          }).catch((err) => {return;})
  }
}

function pause(message, serverQueue) {
  let l = lan.zh_TW
  if (!message.member.voice.channel)
    return message.channel.send(l.pause.No_join)
  if (!serverQueue)
    return message.channel.send(l.pause.No_song);
  serverQueue.connection.dispatcher.pause()
  serverQueue.playing = false
  message.channel.send(l.pause.pause)
}

function volume(message, serverQueue) {
  let l = lan.zh_TW
  if (!message.member.voice.channel)
    return message.channel.send(l.pause.No_join)
  if (!serverQueue)
    return message.channel.send(l.pause.No_song);
    const args = message.content.split(" ");
    if(args[1] == "" || args[1] == null || args[1] == " ") return message.channel.send(l.vol.set + (serverQueue.volume*10) +"%")
    if(isNaN(args[1])) return message.channel.send(l.vol.isNAN)
    let num = parseInt(args[1])
    if(num > 300 || num < 0) return message.channel.send(l.vol.isNAN)
    num = num*0.1
    let numshow = num*10
  serverQueue.connection.dispatcher.setVolume(num*0.1)
  serverQueue.volume = num
  if(num === 0) {
    message.channel.send(l.vol.mute)
  }else {
  message.channel.send(l.vol.set + numshow +"%")
  }
}

function remove(message, serverQueue) {
  let l = lan.zh_TW
  if (!message.member.voice.channel)
    return message.channel.send(l.remove.No_join)
  if (!serverQueue)
    return message.channel.send(l.pause.No_song);
    const args = message.content.split(" ");
    if(isNaN(args[1])) return message.channel.send(l.remove.isNAN)
    let num = parseInt(args[1])
    num = num-1
    if(serverQueue.songs[num].order.author.id != message.author.id) {
      let acc = djperm(message,serverQueue)
      if(acc === false) return message.channel.send(l.word.nodj)
    }
    let songes = serverQueue.songs.splice(num,1)
  message.channel.send(l.remove.remove + ` ${songes[0].title}`)
}

function shuffle(message, serverQueue) {
  let l = lan.zh_TW
  if (!message.member.voice.channel)
    return message.channel.send(l.shuffle.No_join)
  if (!serverQueue)
    return message.channel.send(l.pause.No_song);
    serverQueue.songs.sort(() => Math.random() - 0.5);
  message.channel.send(l.shuffle.shuffle)
}

function loop(message, serverQueue) {
  let l = lan.zh_TW
  if (!message.member.voice.channel) return message.channel.send(l.pause.No_join)
  if (!serverQueue) return message.channel.send(l.pause.No_song);
    const args = message.content.split(" ");
    if(message)
    if(args[1] == null || args[1] == "") {
      switchs()
  }else{
    if(args[1] === "all") {all()}
    else if(args[1] === "single") {single()}
    else if(args[1] === "off") {off()}
    else{switchs()}
  }
  function switchs() {
    if(serverQueue.loop === false) {serverQueue.loop = "single";message.channel.send(l.loop.set + l.loop.single)}
    else if(serverQueue.loop === "single") {serverQueue.loop = "all";message.channel.send(l.loop.set + l.loop.all)}
    else if(serverQueue.loop === "all") {serverQueue.loop = false;message.channel.send(l.loop.set + l.loop.off)}
  }
  function all() {
    serverQueue.loop = "all";message.channel.send(l.loop.set + l.loop.all)
  }
  function single() {
    serverQueue.loop = "single";message.channel.send(l.loop.set + l.loop.single)
  }
  function off() {
    serverQueue.loop = false;message.channel.send(l.loop.set + l.loop.off)
  }
}

function nowplaying(message, serverQueue) {
  let l = lan.zh_TW
  if (!message.member.voice.channel)
    return message.channel.send(l.pause.No_join)
  if (!serverQueue)
    return message.channel.send(l.pause.No_song);
    const song = serverQueue.songs[0];
    const seek = (serverQueue.connection.dispatcher.streamTime - serverQueue.connection.dispatcher.pausedTime) / 1000;
    let timeshow = `${Math.floor(seek/60)}:${Math.floor((seek - Math.floor(seek/60)*60) -1)}`
    let timeshow2 = `${Math.floor(song.time/60)}:${(song.time - Math.floor(song.time/60)*60) -1}`
    let x=Math.floor((seek/song.time)*10),y = (10-x)-1
    let good = "▬",bad = "▬",good2 = "",bad2 = "";
    for (i = 0; i < x; i++) {good2 = good + good2}
    for (i = 0; i < y; i++) {bad2 = bad + bad2}
    let show = good2+"🔘"+bad2
    let seekembed = new Discord.MessageEmbed()
    .setTitle(l.np.playstatus).setDescription(`[${song.title}](${song.url})`).setAuthor(`${song.author.name}`,song.author.avatar,song.author.url)
    .addField(l.play.long,`${show}\n\`[${timeshow} / ${timeshow2}]\``).setColor("#49a8ff").setTimestamp().setThumbnail(song.thumbnail).setFooter(l.play.order + song.order.author.username,"https://cdn.discordapp.com/avatars/"+song.order.author.id+"/"+song.order.author.avatar)
  message.channel.send(seekembed).then((im) => {
    im.channel.awaitMessages(m => m.author.id == message.author.id, { max: 1, time: 50000, errors: ['max'] }) 
    .then(collected => {
        if (collected.first().content.toLowerCase().startsWith(prefix)) {
            clearInterval(runs)
            setTimeout(async() => {
            if(!serverQueue.connection.dispatcher) {
              let stopembed = new Discord.MessageEmbed().setTitle(l.np.end).setColor("#d80000")
              im.edit(stopembed)}
            }, 2000);
          }
    }).catch(collected => {
      clearInterval(runs)
      setTimeout(async() => { 
      if(!serverQueue.connection.dispatcher) {
        let stopembed = new Discord.MessageEmbed().setTitle(l.np.end).setColor("#d80000")
       await im.edit(stopembed)}}, 2000);
      clearInterval(runs);})
    let runs= setInterval(async() => {
    if(!serverQueue.connection.dispatcher) {
        let stopembed = new Discord.MessageEmbed().setTitle(l.np.end).setColor("#d80000")
     await im.edit(stopembed);clearInterval(runs);}
    const song = await serverQueue.songs[0];
    const seek = (serverQueue.connection.dispatcher.streamTime - serverQueue.connection.dispatcher.pausedTime) / 1000;
    let timeshow = `${Math.floor(seek/60)}:${Math.floor((seek - Math.floor(seek/60)*60))}`
    let timeshow2 = `${Math.floor(song.time/60)}:${(song.time - Math.floor(song.time/60)*60) -1}`
    let x=Math.floor((seek/song.time)*10),y = (10-x)-1
    let good = "▬",bad = "▬",good2 = "",bad2 = "";
    for (i = 0; i < x; i++) {good2 = good + good2}
    for (i = 0; i < y; i++) {bad2 = bad + bad2}
    let show = good2+"🔘"+bad2
    let seekembed = new Discord.MessageEmbed()
    .setTitle(l.np.playstatus).setDescription(`[${song.title}](${song.url})`).setAuthor(`${song.author.name}`,song.author.avatar,song.author.url)
    .addField(l.play.long,`${show}\n\`[${timeshow} / ${timeshow2}]\``).setColor("#49a8ff").setTimestamp().setThumbnail(song.thumbnail).setFooter(l.play.order + song.order.author.username,"https://cdn.discordapp.com/avatars/"+song.order.author.id+"/"+song.order.author.avatar)
    im.edit(seekembed)
    }, 2000);
  })
}

client.on('voiceStateUpdate', (oldMember,newMember) => {
  let l = lan.zh_TW
  const serverQueue = queue.get(oldMember.guild.id);
  if(!serverQueue) return;
  const oldUserChannel = oldMember.channelID  
  if(oldUserChannel) {
  try {
  if(oldUserChannel === serverQueue.voiceChannel.id) {
    if (oldMember.channel.members.size === 1) {
    setTimeout(() => {
      if (oldMember.channel.members.size === 1) {
    serverQueue.textChannel.send(l.play.No_member)
    serverQueue.voiceChannel.leave();
    queue.delete(oldMember.guild.id);
    return; 
      }
    }, 10000);
    }
  }  
  } catch (error) {return;} 
}
})

function stop(message, serverQueue) {
  let l = lan.zh_TW  
  if (!serverQueue)
    return message.channel.send(l.stop.No_song);
    const voiceChannel = message.member.voice.channel
    if(serverQueue.voiceChannel.id != voiceChannel.id) serverQueue.voiceChannel = voiceChannel
    if (!message.member.voice.channel)
    return message.channel.send(l.stop.No_join)
  serverQueue.songs = [];
  if(serverQueue.connection.discriminator) {
  serverQueue.connection.dispatcher.end();}
  try {
      serverQueue.connection.dispatcher.end()
  } catch (error) {return;}
  message.channel.send(l.stop.stop)
}

function deletesong(serverQueue) {
  if(serverQueue) {
    if(serverQueue.loop === false) {
      serverQueue.songs.shift();
    }else if(serverQueue.loop === "single") {
      return;
    }else if(serverQueue.loop === "all") {
      let owo = serverQueue.songs.shift();
      serverQueue.songs.push(owo)
    }
  }
}

function play(guild, song) {
  let l = lan.zh_TW
  const serverQueue = queue.get(guild.id);
  if (!song) {
    const voiceChannel = guild.me.voice.channel;
    if(voiceChannel) {
    if(serverQueue.voiceChannel.id != voiceChannel.id) serverQueue.voiceChannel = voiceChannel
    }
    serverQueue.voiceChannel.leave();
    queue.delete(guild.id);
    serverQueue.textChannel.send(l.play.leave)
    return;
  }
  guild.me.voice.setSelfDeaf(true)
  const dispatcher = serverQueue.connection
    .play(ytdl(song.url,{opusEncoded: true ,quality: 'highestaudio', highWaterMark: 1<<25 }), {highWaterMark: 1})
    .on("finish", () => {
      deletesong(serverQueue)
      serverQueue.skips = 1
      play(guild, serverQueue.songs[0]);
    })
    .on("error", error => {
      serverQueue.textChannel.send(l.play.error +" \n```js"+error+"```")
      deletesong(serverQueue)
      serverQueue.skips = 1
      play(guild, serverQueue.songs[0]);
    });
  dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);
  if(serverQueue.messageID != null) {
    try {
    serverQueue.textChannel.messages.cache.get(serverQueue.messageID).delete()      
    } catch (error) {
      //rip
    }
  }
  let timeshow = `${Math.floor(song.time/60)}:${(song.time - Math.floor(song.time/60)*60) -1}`
  let playembed = new Discord.MessageEmbed().setTitle(`▶__開始播放__:`).setDescription(`[${song.title}](${song.url})`).setAuthor(`${song.author.name}`,song.author.avatar,song.author.url)
  .addField(l.play.long,timeshow+`\n\n→ 🔊[${l.play.online}](https://dckabicord.com/music/${guild.id})`).setColor("#49a8ff").setTimestamp().setThumbnail(song.thumbnail).setFooter(l.play.order + song.order.author.username,"https://cdn.discordapp.com/avatars/"+song.order.author.id+"/"+song.order.author.avatar)
  serverQueue.textChannel.send(playembed).then((w) => {
    serverQueue.messageID = w.id
  })
}

client.login(token);