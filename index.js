const { Client, GatewayIntentBits } = require("discord.js")
const ytdl = require('ytdl-core');
const { createAudioPlayer, createAudioResource, joinVoiceChannel, AudioPlayerStatus, NoSubscriberBehavior } = require('@discordjs/voice');

const client = new Client({
  intents: 3276799
  
});

const player = createAudioPlayer({
  behaviors: {
    noSubscriber: NoSubscriberBehavior.Pause
  }
});

const queue = new Map();
const prefix = config.prefix;
const token = config.token;

client.login(token);

client.on("ready", () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on('messageCreate', async message => {
  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  if (command === "play") {
    if (!message.member.voice.channel) {
      return message.reply('음성 채널에 먼저 들어가주세요!');
    }

    if (!args.length) {
      return message.reply('재생할 노래의 링크나 검색어를 입력해주세요!');
    }

    const voiceChannel = message.member.voice.channel;
    const permissions = voiceChannel.permissionsFor(message.client.user);

    if (!permissions.has("CONNECT") || !permissions.has("SPEAK")) {
      return message.reply('해당 음성 채널에 연결할 권한이 없습니다!');
    }

    let songInfo;
    let songTitle;

    try {
      if (ytdl.validateURL(args[0])) {
        const songData = await ytdl.getInfo(args[0]);
        songInfo = songData.videoDetails;
        songTitle = songInfo.title;
      } else {
        const videoResults = await ytSearch(args.join(' '));
        songInfo = await ytdl.getInfo(videoResults.videos[0].url);
        songTitle = songInfo.videoDetails.title;
      }
    } catch (error) {
      console.error(error);
      return message.reply('노래를 재생하는 중에 오류가 발생했습니다!');
    }

    const song = {
      title: songTitle,
      url: songInfo.video_url
    };

    if (!queue.has(message.guild.id)) {
      const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: message.guild.id,
        adapterCreator: message.guild.voiceAdapterCreator
      });

      queue.set(message.guild.id, [song]);
      play(connection, song, message);
    } else {
      queue.get(message.guild.id).push(song);
      message.channel.send(`${song.title} 노래가 대기열에 추가되었습니다!`);
    }
  } else if (command === "skip") {
    if (!message.member.voice.channel) {
      return message.reply('음성 채널에 먼저 들어가주세요!');
    }

    if (!queue.has(message.guild.id)) {
      return message.reply('현재 재생 중인 노래가 없습니다!');
    }

    player.stop();
    message.channel.send('노래를 스킵 했습니다')
  

  } else if (command === "stop") {
    if (!message.member.voice.channel) {
      return message.reply('음성 채널에 먼저 들어가주세요!');
    }

    if (!queue.has(message.guild.id)) {
      return message.reply('현재 재생 중인 노래가 없습니다!');
    }

    queue.get(message.guild.id).length = 0;
    player.stop();
    message.channel.send('노래를 중지하고 대기열을 초기화했습니다!');

  } else if (command === "queue") {
    if (!message.member.voice.channel) {
      return message.reply('음성 채널에 먼저 들어가주세요!');
    }

    if (!queue.has(message.guild.id)) {
      return message.reply('현재 재생 중인 노래가 없습니다!');
    }

    const currentQueue = queue.get(message.guild.id);
    const queueList = currentQueue.map((song, index) => `${index + 1}. ${song.title}`);

    message.channel.send(`대기열:\n${queueList.join('\n')}`);

  } else if (command === "volume") {
    if (!message.member.voice.channel) {
      return message.reply('음성 채널에 먼저 들어가주세요!');
    }

    if (!queue.has(message.guild.id)) {
      return message.reply('현재 재생 중인 노래가 없습니다!');
    }

    if (!args.length) {
      return message.reply(`현재 볼륨: ${player.state.resource.volume.multiplicative * 100}%`);
    }

    const volume = parseInt(args[0]);

    if (isNaN(volume) || volume < 0 || volume > 100) {
      return message.reply('올바른 볼륨 값을 입력해주세요!');
    }

    const currentQueue = queue.get(message.guild.id);

    player.state.resource.volume.multiplicative = volume / 100;

    message.channel.send(`볼륨을 ${volume}%로 설정했습니다!`);

  }
});

function play(connection, song, message) {
  const stream = ytdl(song.url, { filter: 'audioonly' });
  const resource = createAudioResource(stream, { inlineVolume: true });
  resource.volume.setVolume(0.5);

  player.play(resource);

  player.on(AudioPlayerStatus.Idle, () => {
    currentQueue = queue.get(message.guild.id);
    currentQueue.shift();

    if (currentQueue.length === 0) {
      queue.delete(message.guild.id);
      message.channel.send('노래를 모두 재생했습니다!');
      connection.destroy();
    } else {
      play(connection, currentQueue[0], message);
    }
  });
}
