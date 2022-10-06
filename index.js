const events = require('events');
const eventEmitter = new events.EventEmitter();

const { REST, SlashCommandBuilder, Routes, Client, GatewayIntentBits } = require('discord.js');
const Discord = require('discord.js');
const client = new Client({ intents: 
    // [GatewayIntentBits.Guilds] 
    641
});

const {AudioPlayerStatus, StreamType, createAudioPlayer, createAudioResource, joinVoiceChannel, getVoiceConnection } = require('@discordjs/voice');
const player = createAudioPlayer();

const ytdl = require('ytdl-core');
const {token, nvideaID, tarasManiasID} = require('./auth.json');
const { disconnect } = require('process');

let queuedVideos = [];

client.once('ready', () => {
	console.log('Ready!');
});

client.login(token);

client.on('ready', async function (evt) {
    client.user.setPresence({ activities: [{ name: 'to user requests', type:'LISTENING' }], status: 'online' })

    player.on(AudioPlayerStatus.Playing, () => {
        console.log('playing video');
        // let info = ytdl.getBasicInfo(queuedVideos[0].url).then(() => {
        //     console.log(info)
        // })
        
        const channel = client.channels.cache.get(queuedVideos[0].textChannelId);
        channel.send('Now playing: ' + queuedVideos[0].url)
    })

    player.on(AudioPlayerStatus.Idle, () => {
        console.log('audio player idle')
        let connection = getVoiceConnection(queuedVideos[0].guildId);
        queuedVideos.shift();
        if(queuedVideos.length > 0)
            playNextVideo(connection)
        else
            connection.destroy()
    });
    //UNCOMMENT
    // registerSlashCommands(client.user.id, nvideaID, token);
});

eventEmitter.on('new video', () => {
    console.log('new video event', queuedVideos[queuedVideos.length-1]?.url)

    let connection = getVoiceConnection(queuedVideos[0].guildId);
    if(!connection){
        console.log('no previous connection creating new connection')
        const channel = queuedVideos[0].voiceChannel;
        connection = joinVoiceChannel({
            channelId: channel.id,
            guildId: channel.guild.id,
            adapterCreator: channel.guild.voiceAdapterCreator,
        });
        playNextVideo(connection)
    }
});

async function playNextVideo(connection){
    const stream = ytdl(queuedVideos[0].url, {filter: "audioonly"});
    const resource = createAudioResource(stream, {
        inputType: StreamType.Arbitrary,
    });

    player.play(resource);

    connection.subscribe(player);
}

async function addURLToQueue(interaction){
    // console.log(interaction)
    const memberId = interaction.member.user.id;
    const guildId = interaction.guildId;
    const url = interaction.options.getString('url');

    
    let regexResult = 0;
    // const youtubeRegex = /^((?:https?:)?\/\/)?((?:www|m)\.)?((?:youtube\.com|youtu.be))(\/(?:[\w\-]+\?v=|embed\/|v\/)?)([\w\-]+)(\S+)?$/
    // regexResult = url.match(youtubeRegex)
    //console.log(regexResult)
    const validUrl = ytdl.validateURL(url)

    if(!validUrl)
        return 'Please type a valid youtube URL /caburro!'

    const voiceChannel = interaction.member.voice.channel
    // let voiceChannel = client.guilds.cache.get(guildId).voiceStates.cache.get(memberId)?.channel;
    // console.log(voiceChannel, voiceChannel2)
    if(!voiceChannel){
        return 'You must be on a voice channel to add a video to the queue.'
    }

    queuedVideos.push({url: url, textChannelId: interaction.channelId, voiceChannel: voiceChannel, guildId: guildId})
    eventEmitter.emit('new video');
    // console.log(queuedVideos);
    const auxString = (queuedVideos.length - 1)
    return ('Video added to queue (videos ahead: ' + auxString +'): ' + url)
}

async function disconnectBot(){
    queuedVideos.splice(1);
    player.stop()
    return('Disconnecting... 👋')
}

async function skip(){
    // console.log(queuedVideos)
    // queuedVideos.shift();
    // console.log(queuedVideos)
    player.stop()
    return('Skipping to next track... ⏭')
}

async function resume(){
    player.unpause()
    return('Resuming current track... ▶')
}

async function pause(){
    player.pause()
    return('Pausing current track... ⏸')
}

async function clearQueue(){
    queuedVideos.splice(1);
    return('Queue cleared 🚮')
}


client.on('interactionCreate', async interaction => {
	if (!interaction.isChatInputCommand()) return;

	const { commandName } = interaction;
    const interactionUserId = interaction.member.user.id;

	if (commandName === 'play') {
        addURLToQueue(interaction).then( (resposta) => {
            console.log('resposta', resposta)
            interaction.reply(resposta);
        })
        return;
	} else if (commandName === 'queue') {
		await interaction.reply('wip');
	} else if (commandName === 'clear') {
		clearQueue(interaction).then( (resposta) => {
            console.log('resposta', resposta)
            interaction.reply(resposta);
        })
        return;
	} else if (commandName === 'pause') {
        pause(interaction).then( (resposta) => {
            console.log('resposta', resposta)
            interaction.reply(resposta);
        })
        return;
    } else if (commandName === 'resume') {
        resume(interaction).then( (resposta) => {
            console.log('resposta', resposta)
            interaction.reply(resposta);
        })
        return;
    }else if (commandName === 'skip') {
        skip(interaction).then( (resposta) => {
            console.log('resposta', resposta)
            interaction.reply(resposta);
        })
        return;
    } else if (commandName === 'disconnect') {
        disconnectBot(interaction).then( (resposta) => {
            console.log('resposta', resposta)
            interaction.reply(resposta);
        })
        return;
    }

});

function registerSlashCommands(clientId, guildId, token){
    const commands = [
        new SlashCommandBuilder().setName('play').setDescription('Type a youtube URL to play its audio on your current voice channel').
        addStringOption(option =>
            option.setName('url').setDescription('The URL whose audio will play').setRequired(true)),
        new SlashCommandBuilder().setName('queue').setDescription('Check queued videos'),
        new SlashCommandBuilder().setName('clear').setDescription('Clear').
        addSubcommand(subcommand =>
            subcommand.setName('queue').setDescription('Clear the current video queue')),
        new SlashCommandBuilder().setName('pause').setDescription('Pause current video'),
        new SlashCommandBuilder().setName('resume').setDescription('Resume current video'),
        new SlashCommandBuilder().setName('skip').setDescription('Skip current video'),
        new SlashCommandBuilder().setName('disconnect').setDescription('Disconnect Bot, clear queue')
    ]

    .map(command => command.toJSON());

    const rest = new REST({ version: '10' }).setToken(token);

    rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands })
        .then((data) => console.log(`Successfully registered ${data.length} application commands.`))
        .catch(console.error);
}