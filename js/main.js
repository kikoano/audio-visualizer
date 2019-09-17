//global renderer
const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setClearColor(0x000000);
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

//WEB VR
if ('getVRDisplays' in navigator) {
    document.body.appendChild(THREE.WEBVR.createButton(renderer));
    renderer.vr.enabled = true;
}

//global camera
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);

//global clock
let clock = new THREE.Clock();

//global AsciiEffect
effect = new THREE.AsciiEffect(renderer, ' .:-+*=%@#', { invert: true });
effect.setSize(window.innerWidth, window.innerHeight);
effect.domElement.style.color = 'white';
effect.domElement.style.backgroundColor = 'black';

//auto resize
window.addEventListener("resize", () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    effect.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
});

//Music list
const music = ["Alan Walker - Fade.mp3", "Darude - Sandstorm.mp3", "Half-Life 2 - Path Of Borealis.mp3", "TES V - From Past to Present.mp3", "Kenet & Rez - Unreal Superhero 3.mp3"].sort();

//Get query string music parameter
const params = new URLSearchParams(window.location.search);
const musicParam = params.get("music");

//Set defaul music
let defaulMusic = music[0];
if (musicParam != null)
    defaulMusic = music[musicParam];

//Scene list
const scenes = ["Ball", "Wave"];

//global listener
const listener = new THREE.AudioListener();
camera.add(listener);

//global audio
const audio = new THREE.Audio(listener);

//global audioLoader
const audioLoader = new THREE.AudioLoader();

//Get file text sync
const getFileText = (url) => {
    const req = new XMLHttpRequest();
    req.open("GET", url, false);
    req.send(null);
    return (req.status == 200) ? req.responseText : null;
};

//for currentt time to be able to continue
let pausedTime = 0;

//GUI controls
const guiData = {
    music: defaulMusic,
    scene: scenes[0],
    currentTime: 0.1,
    volume: 1,
    backgroundColor: 0x111111,
    asciiEffect: false,
    fftSize: 512,
    stats: true,
    customMusicName: "",
    customMusic: () => {
        //open custom music file
        document.getElementById('fileMusic').click();
    },
    pauseResumeMusic: () => {
        //pause and resume current music
        if (audio.isPlaying) {
            audio.pause();
            pausedTime = guiData.currentTime;
            pauseResumeControl.name("▶️ Resume");
        } else {
            audio.play();
            pauseResumeControl.name("⏸️ Pause");
        }
    }
}
//global GUI
let gui;
let folderMain;
let currentTimeGui;
let pauseResumeControl;
let asciiEffectControl;
let musicControl;
let volumeControl;
let backgroundColorControl;
let sceneConrol;
let fftSizeControl;
let statsControl;

//Create gui(Creaing new gui each scene so different presets can work on each scene)
const createGui = (preset) => {
    if (gui != null) {
        gui.destroy();
    }

    gui = new dat.GUI({ width: 300, load: JSON.parse(getFileText("presets/" + preset)), preset: "Default" });
    folderMain = gui.addFolder("Main");
    folderMain.open();

    sceneConrol = folderMain.add(guiData, "scene", scenes).name("Scene");
    musicControl = folderMain.add(guiData, "music", music).listen().name("Music");
    currentTimeGui = folderMain.add(guiData, "currentTime", 0, 0).listen().name("Current time");

    pauseResumeControl = folderMain.add(guiData, "pauseResumeMusic");
    if (guiData.pauseResumeMusic)
        pauseResumeControl.name("⏸️ Pause");
    else
        pauseResumeControl.name("▶️ Resume");
    volumeControl = folderMain.add(guiData, "volume", 0, 1).name("Volume");
    folderMain.add(guiData, "customMusic").name("📂 Open custom")
    folderMain.add(guiData, "customMusicName").name("Custom music name").listen();

    const folderGlobal = gui.addFolder('Global scene');
    fftSizeControl = folderGlobal.add(guiData, "fftSize", 256, 2048).name("FFT size");
    backgroundColorControl = folderGlobal.addColor(guiData, "backgroundColor").name("Background color");
    asciiEffectControl = folderGlobal.add(guiData, "asciiEffect").name("Ascii effect");
    statsControl = folderGlobal.add(guiData, "stats").name("Stats");

    if (audio.buffer != null)
        currentTimeGui.__max = timeToMinSecFloat(audio.buffer.duration);
}
//

//Load music
const loadMusic = (name) => {
    //show loading bar and hide folderMain
    document.getElementById("loading").style.display = "block";
    folderMain.hide();

    pauseResumeControl.name("⏸️ Pause");
    pausedTime = 0;
    let add = "";
    if (!name.includes("http")) {
        add = "music/";
        guiData.customMusicName = "";
    }

    audioLoader.load(add + name, (buffer) => {
        audio.setBuffer(buffer);
        audio.setVolume(1);
        audio.play();
        //hide loading bar and show folderMain
        document.getElementById("loading").style.display = "none";
        folderMain.show();

        currentTimeGui.__max = timeToMinSecFloat(audio.buffer.duration);
    });
}

//Load custom music file
const fileMusic = document.getElementById("fileMusic");
fileMusic.onchange = () => {
    if (fileMusic.files.length) {
        guiData.music = "";
        guiData.customMusicName = fileMusic.files[0].name;
        audio.stop();
        loadMusic(URL.createObjectURL(fileMusic.files[0]));
    }
};

//Play music again if it finishes(override)
audio.onEnded = () => {
    audio.isPlaying = false;
    if (guiData.music == "")
        loadMusic(URL.createObjectURL(fileMusic.files[0]));
    else
        loadMusic(guiData.music);
}

//global analyser
let analyser = new THREE.AudioAnalyser(audio, guiData.fftSize); //512

//global noise
const noise = new SimplexNoise();

// init frequency data
let frData = {
    lowerMaxFr: null,
    lowerAvgFr: null,
    upperMaxFr: null,
    upperAvgFr: null,
    overallMaxFr: null,
    overallAvgFr: null,
};

//update frequency data
const updateFrData = () => {
    const dataArray = analyser.getFrequencyData();

    lowerHalfArray = dataArray.slice(0, (dataArray.length / 2) - 1);
    upperHalfArray = dataArray.slice((dataArray.length / 2) - 1, dataArray.length - 1);

    lowerMax = Math.max(...lowerHalfArray);
    lowerAvg = avg(lowerHalfArray);
    upperMax = Math.max(...upperHalfArray);
    upperAvg = avg(upperHalfArray);
    overallAvg = avg(dataArray);
    overallMax = Math.max(...dataArray);

    frData.lowerMaxFr = lowerMax / lowerHalfArray.length;
    frData.lowerAvgFr = lowerAvg / lowerHalfArray.length;
    frData.upperMaxFr = upperMax / upperHalfArray.length;
    frData.upperAvgFr = upperAvg / upperHalfArray.length;
    frData.overallMaxFr = overallMax / dataArray.length;
    frData.overallAvgFr = overallAvg / dataArray.length;
}

//float time to minutes and seconds float
const timeToMinSecFloat = (time) => {
    const seconds = time % 60;
    const minutes = (time / 60) % 60;
    return parseInt(minutes) + seconds / 100;
}

//Make rough ball
const makeRoughBall = (mesh, bassFr, treFr) => {
    mesh.geometry.vertices.forEach((vertex, i) => {
        const offset = mesh.geometry.parameters.radius;
        const amp = 7;
        const time = window.performance.now();
        vertex.normalize();
        const rf = 0.00001;
        const distance = (offset + bassFr) + noise.noise3D(vertex.x + time * rf * 7, vertex.y + time * rf * 8, vertex.z + time * rf * 9) * amp * treFr;
        vertex.multiplyScalar(distance);
    });
    mesh.geometry.verticesNeedUpdate = true;
    mesh.geometry.normalsNeedUpdate = true;
    mesh.geometry.computeVertexNormals();
    mesh.geometry.computeFaceNormals();
}

//MakeRoughGround
const makeRoughGround = (mesh, distortionFr) => {
    mesh.geometry.vertices.forEach((vertex, i) => {
        const amp = 2;
        const time = Date.now();
        const distance = (noise.noise2D(vertex.x + time * 0.0003, vertex.y + time * 0.0001) + 0) * distortionFr * amp;
        vertex.z = distance;
    });
    mesh.geometry.verticesNeedUpdate = true;
    mesh.geometry.normalsNeedUpdate = true;
    mesh.geometry.computeVertexNormals();
    mesh.geometry.computeFaceNormals();
}

//fractionate
const fractionate = (val, minVal, maxVal) => {
    return (val - minVal) / (maxVal - minVal);
}

// modulate
const modulate = (val, minVal, maxVal, outMin, outMax) => {
    const fr = fractionate(val, minVal, maxVal);
    const delta = outMax - outMin;
    return outMin + (fr * delta);
}

//average
const avg = (arr) => {
    return (arr.reduce((a, n) => a + n) / arr.length);
}

if (renderer.vr.enabled) {
    //using var to escape scope
    //controller
    var controller = renderer.vr.getController(0);

    const geometry = new THREE.BufferGeometry();
    geometry.addAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, - 1], 3));
    geometry.addAttribute('color', new THREE.Float32BufferAttribute([0.5, 0.5, 0.5, 0, 0, 0], 3));
    const material = new THREE.LineBasicMaterial({ vertexColors: true, color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending });
    controller.add(new THREE.Line(geometry, material));

    //controller input 
    var input = dat.GUIVR.addInputObject(controller);
    controller.addEventListener('selectstart', () => {
        input.pressed(true);
    });
    controller.addEventListener('selectend', () => {
        input.pressed(false)
    });
}

//scene
let scene = null;
let prevScene = null;

//change scene
const changeScene = () => {
    if (guiData.scene != prevScene) {
        if (scene != null)
            scene.delete();
        prevScene = guiData.scene;
        if (guiData.scene == scenes[0]) {
            scene = new BallScene("ballPreset.json");
        }
        else if (guiData.scene == scenes[1]) {
            scene = new WaveScene("wavePreset.json");
        }
    }
}
//Create change gui controls
const createGuiChange = () => {
    asciiEffectControl.onChange(() => {
        if (guiData.asciiEffect)
            document.body.replaceChild(effect.domElement, renderer.domElement);
        else
            document.body.replaceChild(renderer.domElement, effect.domElement);

    });

    musicControl.onChange(() => {
        audio.stop();
        loadMusic(guiData.music);
    });

    volumeControl.onChange(() => {
        listener.setMasterVolume(guiData.volume);
    });

    backgroundColorControl.onChange(() => {
        renderer.setClearColor(guiData.backgroundColor);
    });

    sceneConrol.onFinishChange(changeScene);

    fftSizeControl.onChange(() => {
        let temp = 0;
        for (let i = 256; i <= 2048; i = i + i) {
            if (guiData.fftSize >= i / 1.25)
                temp = i;
        }
        guiData.fftSize = temp;
    });
    fftSizeControl.onFinishChange(() => {
        analyser = new THREE.AudioAnalyser(audio, guiData.fftSize);
    });

    statsControl.onChange(() => {
        stats.dom.hidden = !guiData.stats;
        statsVR.setEnabled(guiData.stats);
    });
}
//

//Scene class
class Scene {
    constructor(preset) {
        //Everything here is init
        createGui(preset);
        createGuiChange();
        this.scene = new THREE.Scene();
        this.scene.add(camera);

        if (renderer.vr.enabled) {

            this.scene.add(controller);

            this.scene.add(input);

            //GUI VR
            this.guiVR = dat.GUIVR.create("Scene");
            this.scene.add(this.guiVR);
        }

        //GUI folder scene
        this.folderScene = gui.addFolder('Scene');

    }
    update(delta) { }
    delete() {
        if (renderer.vr.enabled) {
            this.guiVR.visible = false;
            while (this.guiVR.hitscan.length > 0)
                this.guiVR.hitscan.pop();
            while (this.guiVR.raycast.length > 0)
                this.guiVR.remove(this.guiVR.raycast[0]);
        }

        while (this.scene.children.length > 0) {
            this.scene.remove(this.scene.children[0]);
        }
        //gui.removeFolder(gui.__folders[Object.keys(gui.__folders)[Object.entries(gui.__folders).length - 1]]);
    }
}

//BallScene class
class BallScene extends Scene {
    constructor(preset) {
        //Everything here is init
        super(preset);
        renderer.setClearColor(0x111111);
        this.group = new THREE.Group();

        //Scene GUI data
        this.sceneGuiData = {
            ambientLightIntensity: 1,
            ambientLight: 0xaaaaaa,
            spotLight: 0xffffff,
            spotLightIntensity: 1.3,
            ballRadius: 15,
            ballDetail: 2,
            ballShininess: 30,
            ballFlatShading: true,
            ballWireframe: false,
            ballColor: 0x3880f5,
            ballEmissive: 0x000000,
            ballSpecular: 0x111111,
            planeSegment: 20,
            planeFlatShading: true,
            planeWireframe: false,
            planeColor: 0x7000e1,
            ballBassFrequency: Object.keys(frData)[0],
            ballTreFrequency: Object.keys(frData)[3],
            plane1Frequency: Object.keys(frData)[4],
            plane2Frequency: Object.keys(frData)[0],
            rotation: 0.5
        }
        //set group position so it matches VR camera
        this.group.position.z = -100;

        //GUI folder controls

        gui.remember(this.sceneGuiData);

        this.ambientLightIntensityControl = this.folderScene.add(this.sceneGuiData, "ambientLightIntensity", 0, 5).name("Ambient light intensity").listen();
        this.ambientLightControl = this.folderScene.addColor(this.sceneGuiData, "ambientLight").name("Ambient light color");

        this.spotLightIntensityControl = this.folderScene.add(this.sceneGuiData, "spotLightIntensity", 0, 10).name("Spot light intensity").listen();
        this.spotLightControl = this.folderScene.addColor(this.sceneGuiData, "spotLight").name("Spot light color");

        this.ballRadiusControl = this.folderScene.add(this.sceneGuiData, "ballRadius", 1, 25).name("Ball radius").listen();
        this.ballDetailControl = this.folderScene.add(this.sceneGuiData, "ballDetail", 0, 5, 1).name("Ball detail").listen();
        this.ballShininessControl = this.folderScene.add(this.sceneGuiData, "ballShininess", 0, 500).name("Ball shininess").listen();
        this.ballFlatShadingControl = this.folderScene.add(this.sceneGuiData, "ballFlatShading").name("Ball flat shading").listen();
        this.ballWireframeControl = this.folderScene.add(this.sceneGuiData, "ballWireframe").name("Ball Wireframe").listen();
        this.ballColorControl = this.folderScene.addColor(this.sceneGuiData, "ballColor").name("Ball color");
        this.ballEmissiveControl = this.folderScene.addColor(this.sceneGuiData, "ballEmissive").name("Ball emissive color");
        this.ballSpecularControl = this.folderScene.addColor(this.sceneGuiData, "ballSpecular").name("Ball specular color");

        this.planeSegmentControl = this.folderScene.add(this.sceneGuiData, "planeSegment", 1, 100).name("Plane segment").listen();
        this.planeFlatShadingControl = this.folderScene.add(this.sceneGuiData, "planeFlatShading").name("Plane flat shading").listen();
        this.planeWireframeControl = this.folderScene.add(this.sceneGuiData, "planeWireframe").name("Plane wireframe").listen();
        this.planeColorControl = this.folderScene.addColor(this.sceneGuiData, "planeColor").name("Plane color");

        this.ballBassFrequencyControl = this.folderScene.add(this.sceneGuiData, "ballBassFrequency", Object.keys(frData)).name("Ball frequency").listen();
        //this.ballTreFrequencyControl = this.folderScene.add(this.sceneGuiData,"ballTreFrequency",Object.keys(frData))
        this.plane1FrequencyControl = this.folderScene.add(this.sceneGuiData, "plane1Frequency", Object.keys(frData)).name("Plane 1 frequency").listen();
        this.plane2FrequencyControl = this.folderScene.add(this.sceneGuiData, "plane2Frequency", Object.keys(frData)).name("Plane 2 frequency").listen();

        this.rotationControl = this.folderScene.add(this.sceneGuiData, "rotation", 0, 2).name("Rotation").listen();

        this.planeGeometry = new THREE.PlaneGeometry(800, 800, this.sceneGuiData.planeSegment, this.sceneGuiData.planeSegment);
        const updatePlaneMaterial = () => {
            return new THREE.MeshPhongMaterial({
                color: this.sceneGuiData.planeColor,
                side: THREE.DoubleSide,
                wireframe: this.sceneGuiData.planeWireframe,
                flatShading: this.sceneGuiData.planeFlatShading
            });
        }
        this.planeMaterial = updatePlaneMaterial();

        //plane 1
        this.plane = new THREE.Mesh(this.planeGeometry, this.planeMaterial);
        this.plane.rotation.x = -0.5 * Math.PI;
        this.plane.position.set(0, 40, 0);
        this.group.add(this.plane);

        //plane 2
        this.plane2 = new THREE.Mesh(this.planeGeometry.clone(), this.planeMaterial);
        this.plane2.rotation.x = -0.5 * Math.PI;
        this.plane2.position.set(0, -40, 0);
        this.group.add(this.plane2);

        const updateBallGeometry = () => {
            return new THREE.IcosahedronGeometry(this.sceneGuiData.ballRadius, this.sceneGuiData.ballDetail);
        }
        const icosahedronGeometry = updateBallGeometry();
        const updateBallMaterial = () => {
            return new THREE.MeshPhongMaterial({
                color: this.sceneGuiData.ballColor,
                wireframe: this.sceneGuiData.ballWireframe,
                flatShading: this.sceneGuiData.ballFlatShading,
                shininess: this.sceneGuiData.ballShininess,
                emissive: this.sceneGuiData.ballEmissive,
                specular: this.sceneGuiData.ballSpecular
            });
        }
        this.phongMaterial = updateBallMaterial();

        //ball
        this.ball = new THREE.Mesh(icosahedronGeometry, this.phongMaterial);
        this.ball.position.set(0, 0, 0);
        this.group.add(this.ball);

        //ambientLight
        this.ambientLight = new THREE.AmbientLight(this.sceneGuiData.ambientLight, this.sceneGuiData.ambientLightIntensity);

        this.scene.add(this.ambientLight);

        //spotLight
        this.spotLight = new THREE.SpotLight(this.sceneGuiData.spotLight);
        this.spotLight.intensity = this.sceneGuiData.spotLightIntensity;
        this.spotLight.position.set(-10, 5, 110);
        //this.spotLight.target=this.ball;
        //this.spotLight.lookAt(this.ball.position);
        this.spotLight.castShadow = true;
        this.scene.add(this.spotLight);

        //const spotLightHelper = new THREE.SpotLightHelper(this.spotLight);
        //this.scene.add(spotLightHelper);

        this.scene.add(this.group);

        //All on change gui folder scene controls
        this.ballColorControl.onChange(() => {
            this.ball.material = updateBallMaterial();
        });

        this.planeColorControl.onChange(() => {
            this.plane.material = updatePlaneMaterial();
            this.plane2.material = updatePlaneMaterial();
        });

        this.planeSegmentControl.onChange(() => {
            this.plane.geometry = new THREE.PlaneGeometry(800, 800, this.sceneGuiData.planeSegment, this.sceneGuiData.planeSegment);
            this.plane2.geometry = new THREE.PlaneGeometry(800, 800, this.sceneGuiData.planeSegment, this.sceneGuiData.planeSegment);
        });

        this.planeFlatShadingControl.onChange(() => {
            this.plane.material = updatePlaneMaterial();
            this.plane2.material = updatePlaneMaterial();
        });

        this.planeWireframeControl.onChange(() => {
            this.plane.material = updatePlaneMaterial();
            this.plane2.material = updatePlaneMaterial();
        });

        this.ballRadiusControl.onChange(() => {
            this.ball.geometry = updateBallGeometry();
        });

        this.ballDetailControl.onChange(() => {
            this.ball.geometry = updateBallGeometry();
        });

        this.ballWireframeControl.onChange(() => {
            this.ball.material = updateBallMaterial();
        });

        this.ballFlatShadingControl.onChange(() => {
            this.ball.material = updateBallMaterial();
        });

        this.ballShininessControl.onChange(() => {
            this.ball.material = updateBallMaterial();
        });

        this.ballEmissiveControl.onChange(() => {
            this.ball.material = updateBallMaterial();
        });

        this.ballSpecularControl.onChange(() => {
            this.ball.material = updateBallMaterial();
        });

        this.ambientLightControl.onChange(() => {
            this.ambientLight.color.setHex(this.sceneGuiData.ambientLight);
        });

        this.ambientLightIntensityControl.onChange(() => {
            this.ambientLight.intensity = this.sceneGuiData.ambientLightIntensity;
        });

        this.spotLightControl.onChange(() => {
            this.spotLight.color.setHex(this.sceneGuiData.spotLight);
        });

        this.spotLightIntensityControl.onChange(() => {
            this.spotLight.intensity = this.sceneGuiData.spotLightIntensity;
        });
        //

        //VR GUI
        if (renderer.vr.enabled) {
            this.guiVR.add(this.sceneGuiData, "ambientLightIntensity", 0, 5).onChange(() => { this.ambientLight.intensity = this.sceneGuiData.ambientLightIntensity; }).listen().name("Ambient light intensity");

            this.guiVR.add(this.sceneGuiData, "spotLightIntensity", 0, 10).onChange(() => { this.spotLight.intensity = this.sceneGuiData.spotLightIntensity; }).listen().name("Spot light intensity");

            this.guiVR.add(this.sceneGuiData, "ballRadius", 1, 25).onChange(() => { this.ball.geometry = updateBallGeometry(); }).listen().name("Ball radius");
            this.guiVR.add(this.sceneGuiData, "ballDetail", 0, 5).step(1).onChange(() => { this.ball.geometry = updateBallGeometry(); }).listen().name("Ball detail");
            this.guiVR.add(this.sceneGuiData, "ballShininess", 0, 500).onChange(() => { this.ball.material = updateBallMaterial(); }).listen().name("Ball shininess");
            this.guiVR.add(this.sceneGuiData, "ballFlatShading").onChange(() => { this.ball.material = updateBallMaterial(); }).listen().name("Ball flat shading");
            this.guiVR.add(this.sceneGuiData, "ballWireframe").onChange(() => { this.ball.material = updateBallMaterial(); }).listen().name("Ball Wireframe");

            this.guiVR.add(this.sceneGuiData, "planeSegment", 1, 100).onChange(() => {
                this.plane.geometry = new THREE.PlaneGeometry(800, 800, this.sceneGuiData.planeSegment, this.sceneGuiData.planeSegment);
                this.plane2.geometry = new THREE.PlaneGeometry(800, 800, this.sceneGuiData.planeSegment, this.sceneGuiData.planeSegment);
            }).listen().name("Plane segment");
            this.guiVR.add(this.sceneGuiData, "planeFlatShading").onChange(() => {
                this.plane.material = updatePlaneMaterial();
                this.plane2.material = updatePlaneMaterial();
            }).listen().name("Plane flat shading");
            this.guiVR.add(this.sceneGuiData, "planeWireframe").onChange(() => {
                this.plane.material = updatePlaneMaterial();
                this.plane2.material = updatePlaneMaterial();
            }).listen().name("Plane wireframe");

            this.guiVR.add(this.sceneGuiData, "ballBassFrequency", Object.keys(frData)).listen();
            this.guiVR.add(this.sceneGuiData, "plane1Frequency", Object.keys(frData)).listen();
            this.guiVR.add(this.sceneGuiData, "plane2Frequency", Object.keys(frData)).listen();

            this.guiVR.add(this.sceneGuiData, "rotation", 0, 2).listen().name("Rotation");

            this.guiVR.position.set(0.8, 2.2, -1.2);
            this.guiVR.rotateY(-Math.PI / 4);
        }
    }

    update(delta) {
        makeRoughGround(this.plane, modulate(frData[this.sceneGuiData.plane1Frequency], 0, 1, 0.5, 4));
        makeRoughGround(this.plane2, modulate(frData[this.sceneGuiData.plane2Frequency], 0, 1, 0.5, 4));

        makeRoughBall(this.ball, modulate(Math.pow(frData[this.sceneGuiData.ballBassFrequency], 0.8), 0, 1, 0, 8), modulate(frData[this.sceneGuiData.ballTreFrequency], 0, 1, 0, 4));

        if (renderer.vr.isPresenting())
            this.ball.rotation.y += this.sceneGuiData.rotation * delta;
        else
            this.group.rotation.y += this.sceneGuiData.rotation * delta;
    }
}

//WaveScene class
class WaveScene extends Scene {
    constructor(preset) {
        //Everything here is init
        super(preset);

        renderer.setClearColor(0x000000);
        this.group = new THREE.Group();
        this.scene.add(this.group);

        //Scene GUI data
        this.sceneGuiData = {
            separation: 80,
            widthWave: 120,
            heightWave: 80,
            paricleScale: 500,
            particle1Color: 0x1ffcc8,
            particle2Color: 0x1ffcc8,
            waveSpeed: 12,
            waveFrequency: Object.keys(frData)[4]

        }

        gui.remember(this.sceneGuiData);

        //GUI folder controls
        this.separationControl = this.folderScene.add(this.sceneGuiData, "separation", 10, 300).name("Separation").listen();
        this.widthWaveControl = this.folderScene.add(this.sceneGuiData, "widthWave", 1, 200).name("Wave width").listen();
        this.heightWaveControl = this.folderScene.add(this.sceneGuiData, "heightWave", 1, 200).name("Wave height").listen();
        this.paricleScaleControl = this.folderScene.add(this.sceneGuiData, "paricleScale", 100, 1000).name("Paricle scale").listen();
        this.particle1ColorControl = this.folderScene.addColor(this.sceneGuiData, "particle1Color").name("Particle 1 color");
        this.particle2ColorControl = this.folderScene.addColor(this.sceneGuiData, "particle2Color").name("Particle 2 color");
        this.waveSpeedControl = this.folderScene.add(this.sceneGuiData, "waveSpeed", 1, 20).name("Wave speed").listen();
        //this.waveFrequencyControl = this.folderScene.add(this.sceneGuiData, "waveFrequency", Object.keys(frData)).listen();

        this.count = 0;
        let numParticles = this.sceneGuiData.widthWave * this.sceneGuiData.heightWave;

        // Create positions and scales for particles
        let positions = new Float32Array(numParticles * 3);
        let scales = new Float32Array(numParticles);

        // Update positions and scales for particles 
        const updatePosScale = (positions, scales) => {
            let i = 0, j = 0;
            for (let ix = 0; ix < this.sceneGuiData.widthWave; ix++) {
                for (let iy = 0; iy < this.sceneGuiData.heightWave; iy++) {
                    positions[i] = ix * this.sceneGuiData.separation - ((this.sceneGuiData.widthWave * this.sceneGuiData.separation) / 2); // x
                    positions[i + 1] = 0; // y
                    positions[i + 2] = iy * this.sceneGuiData.separation - ((this.sceneGuiData.heightWave * this.sceneGuiData.separation) / 2); // z
                    scales[j] = 1;
                    i += 3;
                    j++;
                }
            }
        }

        updatePosScale(positions, scales);

        //Create Geometry for the particles
        const geometry = new THREE.BufferGeometry();
        geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.addAttribute('scale', new THREE.BufferAttribute(scales, 1));

        const geometry2 = geometry.clone();

        //Create Material from shaders for the particles
        const material = new THREE.ShaderMaterial({
            uniforms: {
                color: { value: new THREE.Color(this.sceneGuiData.particle1Color) },
                particleScale: { value: this.sceneGuiData.paricleScale }
            },
            vertexShader: getFileText("shaders/wave.vert"),
            fragmentShader: getFileText("shaders/wave.frag")
        });
        const material2 = material.clone();

        //Create and add particles
        this.particles = new THREE.Points(geometry, material);
        this.particles.position.y = -1200;
        this.particles.rotateX(Math.PI / 8);

        this.particles2 = new THREE.Points(geometry.clone(), material2);
        this.particles2.position.y = 1200;
        this.particles2.rotateZ(Math.PI);
        this.particles2.rotateX(Math.PI / 8.5);

        this.group.position.z = -5800;
        this.group.add(this.particles);
        this.group.add(this.particles2);

        const updateWidthHeightWave = (positions, scales, geometry) => {
            numParticles = this.sceneGuiData.widthWave * this.sceneGuiData.heightWave;
            positions = new Float32Array(numParticles * 3);
            scales = new Float32Array(numParticles);
            updatePosScale(positions, scales);

            geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
            geometry.addAttribute('scale', new THREE.BufferAttribute(scales, 1));
        }
        //All on change gui folder scene controls
        this.separationControl.onChange(() => {
            updatePosScale(this.particles.geometry.attributes.position.array, this.particles.geometry.attributes.scale.array);
            updatePosScale(this.particles2.geometry.attributes.position.array, this.particles2.geometry.attributes.scale.array);
        });

        this.widthWaveControl.onChange(() => {
            updateWidthHeightWave(this.particles.geometry.attributes.position.array, this.particles.geometry.attributes.scale.array, this.particles.geometry);
            updateWidthHeightWave(this.particles2.geometry.attributes.position.array, this.particles2.geometry.attributes.scale.array, this.particles2.geometry);
        });

        this.heightWaveControl.onChange(() => {
            updateWidthHeightWave(this.particles.geometry.attributes.position.array, this.particles.geometry.attributes.scale.array, this.particles.geometry);
            updateWidthHeightWave(this.particles2.geometry.attributes.position.array, this.particles2.geometry.attributes.scale.array, this.particles2.geometry);
        });

        this.particle1ColorControl.onChange(() => material.uniforms.color.value = new THREE.Color(this.sceneGuiData.particle1Color));
        this.particle2ColorControl.onChange(() => material2.uniforms.color.value = new THREE.Color(this.sceneGuiData.particle2Color));

        this.paricleScaleControl.onChange(() => {
            material.uniforms.particleScale.value = this.sceneGuiData.paricleScale;
            material2.uniforms.particleScale.value = this.sceneGuiData.paricleScale;
        });

        //

        //VR GUI
        if (renderer.vr.enabled) {
            this.guiVR.add(this.sceneGuiData, "separation", 10, 300).onChange(() => {
                updatePosScale(this.particles.geometry.attributes.position.array, this.particles.geometry.attributes.scale.array);
                updatePosScale(this.particles2.geometry.attributes.position.array, this.particles2.geometry.attributes.scale.array);
            }).name("Separation").listen();

            this.guiVR.add(this.sceneGuiData, "widthWave", 1, 200).onChange(() => {
                updateWidthHeightWave(this.particles.geometry.attributes.position.array, this.particles.geometry.attributes.scale.array, this.particles.geometry);
                updateWidthHeightWave(this.particles2.geometry.attributes.position.array, this.particles2.geometry.attributes.scale.array, this.particles2.geometry);
            }).name("Wave width").listen();

            this.guiVR.add(this.sceneGuiData, "heightWave", 1, 200).onChange(() => {
                updateWidthHeightWave(this.particles.geometry.attributes.position.array, this.particles.geometry.attributes.scale.array, this.particles.geometry);
                updateWidthHeightWave(this.particles2.geometry.attributes.position.array, this.particles2.geometry.attributes.scale.array, this.particles2.geometry);
            }).name("Wave height").listen();

            this.guiVR.add(this.sceneGuiData, "paricleScale", 100, 1000).name("Paricle scale").listen();
            this.guiVR.add(this.sceneGuiData, "waveSpeed", 1, 20).onChange(() => {
                material.uniforms.particleScale.value = this.sceneGuiData.paricleScale;
                material2.uniforms.particleScale.value = this.sceneGuiData.paricleScale;
            }).name("Wave speed").listen();


            this.guiVR.position.set(1.2, 2.2, -0.8);
            this.guiVR.rotateY(-Math.PI / 2.5);
        }
    }
    updateParticles(particles, frequency, offscale) {
        const positions = particles.geometry.attributes.position.array;
        const scales = particles.geometry.attributes.scale.array;
        let i = 0, j = 0;

        for (let ix = 0; ix < this.sceneGuiData.widthWave; ix++) {
            for (let iy = 0; iy < this.sceneGuiData.heightWave; iy++) {
                positions[i + 1] = ((Math.sin((ix + this.count) * 0.3) * modulate(frData[frequency], 0.8, 1, 0, iy * ix / 10 / offscale)) + (Math.sin((iy + this.count) * 0.5) * modulate(frData[frequency], 0.8, 1, 0, iy * ix / 50 / offscale)));
                scales[j] = ((Math.sin((ix + this.count) * 0.3) + 1) * modulate(frData[frequency], 0.8, 1, 0, iy * ix / 150 / offscale) + (Math.sin((iy + this.count) * 0.5) + 1) * modulate(frData[frequency], 0.8, 1, 0, iy * ix / 150 / offscale));
                i += 3;
                j++;
            }
        }

        particles.geometry.attributes.position.needsUpdate = true;
        particles.geometry.attributes.scale.needsUpdate = true;
    }

    update(delta) {
        this.updateParticles(this.particles, this.sceneGuiData.waveFrequency, 1);
        this.updateParticles(this.particles2, "lowerMaxFr", 10);

        this.count += (modulate(frData[this.sceneGuiData.waveFrequency], 0, 1, 0, this.sceneGuiData.waveSpeed * Math.pow(frData[this.sceneGuiData.waveFrequency], 4) * 2) * delta);

    }
}

//Load default scene
changeScene();

//Load default music
loadMusic(guiData.music);

//stats
const stats = new Stats();
stats.showPanel(0);
document.body.appendChild(stats.dom);

//stats VR
const statsVR = new StatsVR(scene.scene, camera);
statsVR.setY(2.6);

//render
const render = () => {
    //requestAnimationFrame(render);
    renderer.setAnimationLoop(render);

    updateFrData();
    scene.update(clock.getDelta(), frData);

    //Update music current time
    const time = parseInt(audio.context.currentTime - audio.startTime);
    if (audio.isPlaying)
        guiData.currentTime = timeToMinSecFloat(time) + pausedTime;

    // normal and asciiEffect render on/off
    if (guiData.asciiEffect)
        effect.render(scene.scene, camera);
    else
        renderer.render(scene.scene, camera);

    if (guiData.stats) {
        if (renderer.vr.isPresenting())
            statsVR.update();
        else
            stats.update();
    }
}
render();
