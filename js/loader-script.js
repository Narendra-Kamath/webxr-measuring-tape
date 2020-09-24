window.addEventListener("DOMContentLoaded", function () {
  if (navigator.xr) {
    navigator.xr.isSessionSupported("immersive-ar").then(async (supported) => {
      if (supported) {
        document.getElementById("renderCanvas").style.display = "block";
        document.getElementById("info-message").style.display = "none";

        var canvas = document.getElementById("renderCanvas");
        var engine = new BABYLON.Engine(canvas, true);
        var createScene = async function () {
          var scene = new BABYLON.Scene(engine);
          var camera = new BABYLON.FreeCamera(
            "myCamera",
            new BABYLON.Vector3(0, 1, -5),
            scene
          );

          var ui = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI(
            "myUI"
          );

          var renderScale = 1.0;
          var hardwareScalingLevel = 0.5;

          engine.setHardwareScalingLevel(hardwareScalingLevel);
          ui.renderScale = renderScale;

          var guiText = new BABYLON.GUI.TextBlock();
          guiText.text = "";
          guiText.height = `${(200 * renderScale) / hardwareScalingLevel}px`;
          guiText.color = "white";
          guiText.fontSize = (32 * renderScale) / hardwareScalingLevel;
          guiText.verticalAlignment =
            BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
          guiText.textHorizontalAlignment =
            BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
          guiText.horizontalAlignment =
            BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
          guiText.top = `${(50 * renderScale) / hardwareScalingLevel}px`;
          guiText.left = `${(50 * renderScale) / hardwareScalingLevel}px`;
          ui.addControl(guiText);

          camera.setTarget(BABYLON.Vector3.Zero());
          camera.attachControl(canvas, true);

          var light = new BABYLON.HemisphericLight(
            "light",
            new BABYLON.Vector3(0, 5, 0),
            scene
          );
          light.diffuse = BABYLON.Color3.White();
          light.intensity = 0.1;
          light.specular = new BABYLON.Color3(0, 0, 0);

          var xr = await scene.createDefaultXRExperienceAsync({
            optionalFeatures: true,
            disableDefaultUI: true,
          });

          var enterXRButton = BABYLON.GUI.Button.CreateSimpleButton(
            "enterXRButton",
            "Measure iT"
          );

          enterXRButton.width = `${
            (300 * renderScale) / hardwareScalingLevel
          }px`;
          enterXRButton.height = `${
            (50 * renderScale) / hardwareScalingLevel
          }px`;
          enterXRButton.color = "white";
          enterXRButton.fontSize = (28 * renderScale) / hardwareScalingLevel;
          enterXRButton.background = "green";
          enterXRButton.isVisible = true;

          var pairs = [];

          xr.baseExperience.onStateChangedObservable.add((state) => {
            if (state === BABYLON.WebXRState.ENTERING_XR) {
              // console.log("Camera position before: " + camera.globalPosition);
            } else if (state === BABYLON.WebXRState.IN_XR) {
              // console.log("Camera position after: " + xr.baseExperience.camera.globalPosition);
              enterXRButton.isVisible = false;
            } else if (state === 3) {
              console.log(state);
              enterXRButton.isVisible = true;
            }
          });

          const fm = xr.baseExperience.featuresManager;

          fm.enableFeature(BABYLON.WebXRBackgroundRemover);
          const hitTest = fm.enableFeature(BABYLON.WebXRHitTest, "latest");
          const anchorSystem = fm.enableFeature(
            BABYLON.WebXRAnchorSystem,
            "latest"
          );

          const dot = BABYLON.SphereBuilder.CreateSphere(
            "dot",
            {
              diameter: 0.05,
            },
            scene
          );
          dot.rotationQuaternion = new BABYLON.Quaternion();

          dot.material = new BABYLON.StandardMaterial("dot", scene);
          dot.material.emissiveColor = BABYLON.Color3.FromHexString("#CC9423");

          dot.isVisible = false;

          let lastHitTest = null;

          let currentPair = null;

          let anchorsAvailable = false;

          hitTest.onHitTestResultObservable.add((results) => {
            if (results.length) {
              dot.isVisible = true;
              results[0].transformationMatrix.decompose(
                dot.scaling,
                dot.rotationQuaternion,
                dot.position
              );
              lastHitTest = results[0];
              if (currentPair) {
                if (currentPair.line) {
                  currentPair.line.dispose();
                }
                currentPair.line = BABYLON.Mesh.CreateLines(
                  "lines",
                  [currentPair.startDot.position, dot.position],
                  scene
                );
                const dist = BABYLON.Vector3.Distance(
                  currentPair.startDot.position,
                  dot.position
                );
                let roundDist = Math.round(dist * 100) / 100;
                currentPair.text.text = roundDist + "m";
                guiText.text =
                  "Last Measure:\n" +
                  roundDist +
                  "m\n" +
                  Math.round((roundDist / 0.3048) * 100) / 100 +
                  "ft\n" +
                  Math.round(roundDist * 39.37 * 100) / 100 +
                  "in\n" +
                  Math.round(roundDist * 100 * 100) / 100 +
                  "cm";
              }
            } else {
              lastHitTest = null;
              dot.isVisible = false;
              guiText.text = "";
            }
          });

          const processClick = () => {
            const newDot = dot.clone("newDot");
            if (!currentPair) {
              const label = new BABYLON.GUI.Rectangle("label");
              label.background = "black";
              label.height = "60px";
              label.alpha = 0.5;
              label.width = "200px";
              label.cornerRadius = 20;
              label.thickness = 1;
              label.zIndex = 5;
              label.top = -30;
              ui.addControl(label);

              const text = new BABYLON.GUI.TextBlock();
              text.color = "white";
              text.fontSize = "36px";
              label.addControl(text);
              currentPair = {
                startDot: newDot,
                label,
                text,
              };
            } else {
              currentPair.label.linkWithMesh(newDot);
              currentPair.endDot = newDot;
              pairs.push(currentPair);
              currentPair = null;
            }
            return newDot;
          };

          anchorSystem.onAnchorAddedObservable.add((anchor) => {
            anchor.attachedNode = processClick();
          });

          enterXRButton.onPointerUpObservable.add(async function () {
            const session = await xr.baseExperience.enterXRAsync(
              "immersive-ar",
              "unbounded",
              xr.renderTarget
            );

            scene.onPointerObservable.add(async (eventData) => {
              if (lastHitTest) {
                if (lastHitTest.xrHitResult.createAnchor) {
                  const anchor = await anchorSystem.addAnchorPointUsingHitTestResultAsync(
                    lastHitTest
                  );
                } else {
                  processClick();
                }
              }
            }, BABYLON.PointerEventTypes.POINTERDOWN);
          });

          xr.baseExperience.sessionManager.onXRFrameObservable.add(() => {
            pairs.forEach((pair) => {
              pair.line.dispose();
              pair.line = BABYLON.Mesh.CreateLines(
                "lines",
                [pair.startDot.position, pair.endDot.position],
                scene
              );
            });
          });

          ui.addControl(enterXRButton);

          return scene;
        };
        var scene = await createScene();

        engine.runRenderLoop(function () {
          scene.render();
        });

        window.addEventListener("resize", function () {
          engine.resize();
        });
      } else {
        document.getElementById("renderCanvas").style.display = "none";
        document.getElementById("info-message").style.display = "block";
        document.getElementById("info-message").innerText =
          "Unfortunately your device doesn't support Immersive AR of WebXR";
      }
    });
  } else {
    document.getElementById("renderCanvas").style.display = "none";
    document.getElementById("info-message").style.display = "block";
    document.getElementById("info-message").innerText =
      "Unfortunately your device doesn't support WebXR";
  }
});
