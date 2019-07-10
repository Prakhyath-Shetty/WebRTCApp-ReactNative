/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 * @flow
 */

import React, {Component} from 'react';
import {Platform, StyleSheet, Text, View, Button, Dimensions} from 'react-native';
import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  RTCView,
  MediaStream,
  MediaStreamTrack,
  mediaDevices
} from 'react-native-webrtc';
import io from 'socket.io-client';

const dimensions = Dimensions.get('window');


export default class App extends Component {
  constructor(props){
    super(props);
    this.handleConnect=this.handleConnect.bind(this)
    this.setupWebRTC=this.setupWebRTC.bind(this)
    this.onConnectionStateChange=this.onConnectionStateChange.bind(this)
    this.onAddStream=this.onAddStream.bind(this)
    this.onIceCandidate=this.onIceCandidate.bind(this)
    this.handleAnswer=this.handleAnswer.bind(this)
    this.onReceiveOffer=this.onReceiveOffer.bind(this)
    this.onReceiveAnswer=this.onReceiveAnswer.bind(this)
    this.state={
      localStreamURL:null,
      remoteStreamURL:null,
      iceConnectionState:'',
      iceCandidates:[],
      isAnswerReceived:false,
      isOfferReceived:false,
      offer:{},
      answer:{},
      localVideo:{},
      remoteVideo:{},
      localVideoStream:{},
      desc:""
    }
  }

  async setupWebRTC() {
    const configuration = {"iceServers": [{"url": "stun:stun.l.google.com:19302"}]};
    const pc = new RTCPeerConnection(configuration);
    pc.onconnectionstatechange=this.onConnectionStateChange
    pc.onaddstream=this.onAddStream
    pc.onicecandidate=this.onIceCandidate

    console.log('localStream:',this.state.localVideoStream)
    pc.addStream(this.state.localVideoStream)
    this.pc = pc;
  }

  async handleConnect(e) {
    await this.setupWebRTC();
    const { pc } = this;

    try {
      // Create Offer
      pc.createOffer({offerToReceiveVideo:true,
        offerToReceiveAudio:true}).then(desc => {
        pc.setLocalDescription(desc).then(() => {
          console.log("Sdp",desc);
          this.setState({desc});
        });
      });
    } catch (error) {
      console.log(error);
    }
  }

  onConnectionStateChange(e) {
    console.log("onConnectionStateChange",e);
    this.setState({
      iceConnectionState: e.target.iceConnectionState
    })
  }

  onAddStream(e) {
    console.log("onAddStream",e.stream.toURL());
    console.log("onAddStream toatal",e.stream);
    this.setState({
      remoteVideo:e.stream,
      remoteStreamURL: e.stream.toURL()
    })
    this.remoteStream = e.stream
  }

  onIceCandidate(e) {
    const { candidate } = e;
    if (candidate) {
      const { iceCandidates } = this.state;
      if (Array.isArray(iceCandidates)) {
        this.setState({
          iceCandidates: [...iceCandidates, candidate]
        })
      } else {
        this.setState({
          iceCandidates: [candidate]
        })
      }
    } else {
      if (this.state.iceCandidates.length > 1) {
        //send this to signaling server
        let offerOrAnswer = {
          type: this.state.isOfferReceived ? 'answer' : 'offer',
          payload: {
            description: this.pc.localDescription,
            iceCandidates: this.state.iceCandidates
          }
        }
        console.log("offerOrAnswer", offerOrAnswer);
        // send offer to signaling server
        if (offerOrAnswer.type == "offer") {
          console.log("offerOrAnswer", offerOrAnswer.type);
          this.socket.emit('offer', JSON.stringify(offerOrAnswer));
          console.log("emit called");
        } else {
          this.socket.emit('answer', JSON.stringify(offerOrAnswer));
        }
      } else {
        console.error("No candidates found");
      }
    }
  }

  onReceiveOffer(offer) {
    this.setState({
      offer:JSON.parse(offer),
      isOfferReceived: true
    }, () => {
      console.log("offer received", offer)
    })
  }

  handleAnswer() {
    const { payload } = this.state.offer;
    this.setupWebRTC();
    
    const { pc } = this;
    var offerSdp = { "sdp": payload.description.sdp, "type": "offer" };
    console.log("setupWebRTC g barpunda?",offerSdp)
    
    pc.setRemoteDescription(new RTCSessionDescription(offerSdp))
    

    if (Array.isArray(payload.candidates)) {
      payload.candidates.forEach((c) => peer.addIceCandidate(new RTCIceCandidate(c)))
    }
    try {
      // Create Offer
      pc.createAnswer().then(answer => {
        pc.setLocalDescription(answer).then(() => {
          // Send pc.localDescription to peer
          console.log("answer generated",answer);
          this.setState({answer},()=>{console.log("setstateanswer")});
        });
      });
    } catch (error) {
      console.log(error);
    }
  }

  onReceiveAnswer(answer) {
    const { payload } = JSON.parse(answer);
    console.log(" onReceiveAnswer payload",payload)
    var answerSdp = { "sdp": payload.description.sdp, "type": "answer" };
    //set answersdp to current peer RemoteDescription.
    this.pc.setRemoteDescription(new RTCSessionDescription(answerSdp))
    payload.iceCandidates.forEach(c => this.pc.addIceCandidate(new RTCIceCandidate(c)))
    this.setState({
      answer:JSON.parse(answer),
      isAnswerReceived: true
    }, () => {
      console.log("answerReceived")
    })
  }

  
  componentDidMount(){
    const self = this;
    var socket = io('http://localhost:3000');
    this.socket=socket;

    socket.on('offer', function (offer) {
      console.log("Offeronsocket",offer)
      self.onReceiveOffer(offer);
    });

    socket.on('answer', function(answer){
      console.log("answeronsocket called",answer)
      self.onReceiveAnswer(answer);
    });

    let isFront = true;
    mediaDevices.enumerateDevices().then(sourceInfos => {
      console.log(sourceInfos);
      let videoSourceId;
      for (let i = 0; i < sourceInfos.length; i++) {
        const sourceInfo = sourceInfos[i];
        if(sourceInfo.facing == (isFront ? "front" : "back")) {
          videoSourceId = sourceInfo.deviceId;
          console.log(sourceInfo);
        }
      }
      mediaDevices.getUserMedia({
        audio: true,
        video: {
          mandatory: {
            minWidth: 500, // Provide your own width, height and frame rate here
            minHeight: 300,
            minFrameRate: 30
          },
          facingMode: (isFront ? "user" : "environment"),
          optional: (videoSourceId ? [{sourceId: videoSourceId}] : [])
        }
      })
      .then(stream => {
        // Got stream!
        console.log("getUserMedia.stream",stream);
        let { localVideo } = self.state;
        localVideo.srcObject = new MediaStream();
        localVideo.srcObject.addTrack(stream.getTracks()[0], stream);
        localVideo.srcObject.addTrack(stream.getTracks()[1], stream);
        console.log("localVideo.srcObject1",localVideo.srcObject);
        this.setState({
            localVideoStream:stream,
            localStreamURL: stream.toURL()
          })
      })
      .catch(error => {
        // Log error
        console.log(error);
      });
    });
  }

  render() {
    console.log("state.offer",this.state.offer);
    console.log("state.answer",this.state.remoteStreamURL);
    return (
      <View style={styles.container}>
        <RTCView streamURL={this.state.localStreamURL} style={styles.rtcView}/>
        <RTCView streamURL={this.state.remoteStreamURL} style={styles.rtcView}/>
        <Button title="connect" onPress={this.handleConnect}></Button>
        <Button title="answer" onPress={this.handleAnswer}></Button>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5FCFF',
  },
  welcome: {
    fontSize: 20,
    textAlign: 'center',
    margin: 10,
  },
  instructions: {
    textAlign: 'center',
    color: '#333333',
    marginBottom: 5,
  },
  rtcView: {
    flex: 1,
    width: dimensions.width / 2,
    backgroundColor: '#f00',
    position: 'relative'
  }
});
