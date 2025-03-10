"use strict";

const Homey 	=	require('homey');
let http 		=	require('http.min');
let request		=	require('request');

let device_id 	=	Homey.ManagerSettings.get('device_id');
let bot_token	=	Homey.env.BOT_TOKEN;
let chat_ids 	=	[];

let custom_bot_token 	=	Homey.ManagerSettings.get('bot_token');

var myWebhook;

var last_msg_id;

var log = [];

console.log = function(string,) {
	let d = new Date();
	let n = d.toLocaleTimeString();
	let item = {};
	item.time = n;
	item.string = string;
	log.push(item);
	Homey.ManagerApi.realtime('log_new', item)
	  .catch( this.error )
	if(log.length > 50){
	  log.splice(0,1);
	}
};

class App extends Homey.App {
	
	onInit() {
		
		chat_ids = Homey.ManagerSettings.get('chat_ids');
		
		var custom_bot = Homey.ManagerSettings.get('bot_token');
		
		console.log ("custom_bot = " + typeof custom_bot + " / " + JSON.stringify (custom_bot));
		
		if (custom_bot !== null) {
			
			bot_token = custom_bot;
			
		}
		
		if (typeof chat_ids != "object") {
			console.log ('Not yet registered with chat_ids');
			chat_ids = [];
		} else {
			
			console.log('We still remembered chat_ids: ' + JSON.stringify(chat_ids));
			
		}
		
		if (custom_bot_token) {
			
			bot_token = custom_bot_token;
			
		}
		
		if (device_id) {

			console.log ('We still remembered device_id: ' + device_id);

		} else {

			var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

			device_id = '';
		    for( var i=0; i < 10; i++ )
		        device_id += possible.charAt(Math.floor(Math.random() * possible.length));

			console.log('new device_id: ' + device_id);
			Homey.ManagerSettings.set('device_id', device_id);

		}
    
		let sendMessage = new Homey.FlowCardAction('sendmessage');
		sendMessage
		    .register()
		    .registerRunListener(( args, state ) => {
		
				console.log('[SEND CHAT] ' + JSON.stringify (args));
				
				if (typeof (args.to !== "undefined") && typeof (args.to.chat_id !== "undefined")) {
					
					sendchat (args.text, args.to.chat_id);
					return Promise.resolve (true);
				
				} else {
					
					return Promise.resolve (false);
					
				}
				
		    })
		    .getArgument('to')
	        .registerAutocompleteListener(( query, args ) => {
	            return Promise.resolve(chat_ids);
	        });

		let sendImage = new Homey.FlowCardAction('sendimage');
		sendImage
			.register()
			.registerRunListener(( args, state) => {
				
				console.log ("[SEND IMAGE] " + JSON.stringify (args));
				
				var custom_bot = Homey.ManagerSettings.get('bot_token');
	
				if (custom_bot !== null && custom_bot != '' && typeof custom_bot != 'undefined') {
					
					bot_token = custom_bot;
					
				} else {
					
					bot_token = Homey.env.BOT_TOKEN;
				
				}
	
				let image = args.droptoken;
				
				if (typeof image !== "undefined" && image !== null) {
					
					image.getBuffer()
					.then( buf => {
						
						var r = request.post("https://api.telegram.org/bot" + bot_token + "/sendPhoto", requestCallback);
						var form = r.form();
						
						form.append('chat_id', args.to.chat_id);
						
						if (image.getFormat() == "jpg") {
							
							console.log ("jpg");
	
							return form.append('photo', new Buffer(buf),
								{contentType: 'image/jpeg', filename: 'x.jpg'});
								
						} else if (image.getFormat() == "gif") {
							
							console.log ("gif");
							
							form.append('photo', new Buffer(buf),
								{contentType: 'image/gif', filename: 'x.gif'});
							
						} else if (image.getFormat() == "png") {
							
							console.log ("png");
							
							form.append('photo', new Buffer(buf),
								{contentType: 'image/png', filename: 'x.png'});
								
						}
						
						function requestCallback(err, res, body) {
						  console.log(body);
						  
						  if (typeof body !== "undefined") {
							  
							  if (typeof body.ok !== "undefined") {
						  
								  if (body.ok == true) {
									  return Promise.resolve(true);
								  } else {
									  return Promise.resolve(false);
								  }
								  
							   } else {
								   return Promise.resolve(false);
							   }
							} else {
								return Promise.resolve(false);
							}
						}
					  
					})
					.catch (console.log("sendimage done"))
				
				} else {
					
					return Promise.resolve(false);
					
				}			
			})
			.getArgument('to')
	        .registerAutocompleteListener(( query, args ) => {
	            return Promise.resolve(chat_ids);
	        });
		
		// Register initial webhook
		if (Homey.env.CLIENT_ID && Homey.env.CLIENT_SECRET) {
		
			this.register_webhook();
    
		} else {
			
			console.log ("Missing env.json ... receiving messages will not work. Sending will only work if using a custombot.")
			
		}

	}
	
	unregister_webhook() {
		
		myWebhook
		.unregister()
        .then(() => {
             console.log('Webhook unregistered!');
             
		})
        .catch( this.error )
        
	}
	
	register_webhook(){

		chat_ids = Homey.ManagerSettings.get('chat_ids');
		
		let data = {
			device_id: device_id,
			chat_ids: chat_ids
		}
		
		// Register webhook
		myWebhook = new Homey.CloudWebhook(Homey.env.CLIENT_ID, Homey.env.CLIENT_SECRET, data);
		
		myWebhook
		.on('message', args => {
			
			let eventTrigger = new Homey.FlowCardTrigger('incomingmessage')
			.register()
		    .registerRunListener( (args, state ) => {
	
		        // If true, this flow should run
		        return Promise.resolve(true);
		
		    })
	    
			console.log('[INCOMING] ' + JSON.stringify(args));
			
			if (args.body.message.message_id != last_msg_id || typeof last_msg_id === "undefined" || (typeof args.body.message.text !== "undefined" && args.body.message.text.substr(0,10) == '/register ')) {
				
				last_msg_id = args.body.message.message_id;
				
				if (typeof args.body.message.text !== "undefined") {
					
					if (args.body.message.text.substr(0,10) == '/register ' && args.body.message.text == '/register ' + device_id) {
						
						chat_ids = Homey.ManagerSettings.get('chat_ids');
						
						//See if it is not yet in the list of chat_ids:
						
						if (chat_ids != null) {
						
							let obj = chat_ids.find(o => o.chat_id === args.body.message.chat.id);
						
						} else {
							
							chat_ids = [];
							
						}
						
						console.log ("typeof obj is: " + typeof obj);
						
						if (typeof obj === "undefined") {
						
							if (typeof args.body.message.chat.type !== undefined && args.body.message.chat.type == 'group') {
								
								chat_ids.push({
				                    image: 'https://telegram.org/img/t_logo.png', 
				                    name: args.body.message.chat.title,
				                    description: Homey.__("group"),
				                    chat_id: args.body.message.chat.id
				                });
			                
							} else {
								
								if (typeof args.body.message.from.last_name !== "undefined") {
									
									var name = args.body.message.from.first_name + ' ' + args.body.message.from.last_name
								
								} else {
									
									var name = args.body.message.from.first_name
									
								}
								
								chat_ids.push({
				                    image: 'https://telegram.org/img/t_logo.png', 
				                    name: name,
				                    chat_id: args.body.message.chat.id
				                });
				                
				            }
			            
				            console.log('chat_id added: ' + args.body.message.chat.id);
		                
			                Homey.ManagerSettings.set('chat_ids', chat_ids);
			                
			                console.log ('[chat_ids] ' + JSON.stringify(chat_ids));
							
							this.unregister_webhook();
							this.register_webhook();
		
							sendchat (Homey.__("registered"), args.body.message.chat.id);
						
						} else {
							
							sendchat (Homey.__("already_registered"), args.body.message.chat.id);
							
						}
						
					} else if (args.body.message.text.substr(0,5) == '/help') { // && args.body.message.bot_id == 
						
						sendchat ('INFO: ' + JSON.stringify(args.body), args.body.message.chat.id);
						sendchat (Homey.__("help"), args.body.message.chat.id);
						
					} else if (args.body.message.text.substr(0,5) == '/say ') {
						
						var output = args.body.message.text.substr(5);
						
						Homey.ManagerSpeechOutput.say( output );
						
					} else if (args.body.message.text == 'ping') {
						
						sendchat ('pong SDKv2', args.body.message.chat.id);
						
					} else if (args.body.message.text == 'pong') {
						
						sendchat ('ping SDKv2', args.body.message.chat.id);
							
					} else {
						
						if (typeof args.body.message.from.last_name !== "undefined") {
									
							var name = args.body.message.from.first_name + ' ' + args.body.message.from.last_name
						
						} else {
							
							var name = args.body.message.from.first_name
							
						}
								
						// Trigger event
						eventTrigger
			        	.trigger({
			                message: args.body.message.text || '',
			                user: name || ''
		                })
		                .then( console.log( 'incomingmessage triggered') )
		                .catch( this.error )
						
					}
					
				}
			
			}
			
		 })
        .register()
        .then(() => {
             console.log('Webhook registered!');
             
		})
        .catch( this.error )
	}
	
}
  		
function sendchat (message, chat_id) {

	var custom_bot = Homey.ManagerSettings.get('bot_token');
	
	if (custom_bot !== null && custom_bot != '' && typeof custom_bot != 'undefined') {
		
		bot_token = custom_bot;
		
	} else {
		
		bot_token = Homey.env.BOT_TOKEN;
	
	}
	
	http('https://api.telegram.org/bot' + bot_token + '/sendMessage?chat_id=' + chat_id + '&parse_mode=Markdown&text=' + encodeURIComponent(message)).then(function (result) {
	  	console.log('Code: ' + result.response.statusCode)
	  	console.log('Response: ' + result.data)
	  	
	  	if (result.response.statusCode == 200) return Promise.resolve(true); else return Promise.resolve(false);
	});
}

module.exports = App;