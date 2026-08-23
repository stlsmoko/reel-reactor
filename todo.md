# Project TODO

- [x] Create the Reel Reactor Start and Source Setup flows for local video selection.
- [x] Build the portrait reaction studio with source-video playback, a draggable/resizable camera overlay, and clear recording states.
- [x] Request and surface camera, microphone, and media-library permissions only when needed.
- [x] Capture a reaction-camera recording locally and keep its output available for review.
- [x] Add a review screen with re-record, local save, and share actions.
- [x] Add a clean-scene system screen-recording path for an immediately usable merged personal export.
- [ ] Build file-level native composition that merges source video, camera video, and audio into one exported file without using the device screen recorder.
- [x] Add a copied-link fallback that captures a shared post URL as a session draft.
- [ ] Receive content directly from the operating-system Share menu through native iOS and Android share extensions.
- [x] Document the direct-social-video limitations and rights-aware import path in the app.
- [x] Add automated tests for source validation and reaction-studio state transitions.
- [x] Generate and configure a dedicated Reel Reactor icon and app branding.
- [x] Validate source handling and studio state transitions with unit tests, type checking, and linting.
- [ ] Test camera capture, source audio, microphone input, and clean-scene screen recording on a physical iPhone or Android device.
- [ ] Install Reel Reactor on the owner’s Android phone and complete the first physical-device test.
- [ ] Resolve Expo Go’s “Failed to download remote update” error on the owner’s Android preview session.
- [ ] Create and install the standalone Android build through the project Publish workflow as the reliable phone-test fallback.
- [x] Fix the source-setup layout so “Open reaction studio” is always visible and tappable on a 9:16 Android screen.
- [x] Verify the preview service has completed a fresh Metro bundle after the layout repair.
- [x] Replace the ambiguous Camera take control with a prominent Start recording button that clearly changes to Stop recording.
- [x] Make the live camera bubble pass Android touch drags through the camera preview to the parent move gesture.
- [ ] Confirm the revised record button, drag gesture, and resize handle on the owner’s Android device.
- [x] Remove every Expo VideoPlayer pause call that could run after a native player is released during navigation or record completion.
- [x] Replace the ineffective overlay PanResponder behavior with native gesture-handler dragging on Android.
- [x] Build an Android JavaScript bundle successfully after the crash and overlay interaction repairs.
- [x] Repair the Android camera preview lifecycle with immediate permission request, camera mount status, and a native retry control.
- [x] Build an Android bundle successfully after the camera preview lifecycle repair.
- [ ] Confirm the repaired camera opens and can record a short take on the owner’s Android device.
- [x] Replace the silent record-start path with explicit camera/microphone preparation, camera-ready status, and actionable retry feedback.
- [x] Build an Android bundle successfully after the record-start control repair.
- [ ] Confirm Start recording changes to Stop recording and produces a saved short take on the owner’s Android device.
- [x] Replace the persistent non-recording reaction flow with explicit permission, camera-ready, recording, stopping, save, and native-error status feedback.
- [x] Build an Android bundle successfully after the observable recording-state repair.
- [ ] Confirm the live device progresses through Ready to react → Recording reaction → saved review after one short take.
- [ ] Select and validate a maintained native render engine or a compatible Expo/React Native upgrade before implementing true picture-in-picture export.
- [ ] Deliver one exported MP4 that visibly contains the chosen source video, the user-positioned front-camera reaction overlay, source audio, and reaction microphone audio.
- [x] Upgrade the project to Expo 56 / React Native 0.85 and register the supported ffmpeg-expo native compositor plugin.
- [x] Implement the on-device source scaling, positioned overlay, audio-mixing, composite MP4 review, save, and share flow.
- [x] Verify the prebuild configuration includes the compositor plugin plus Android camera and microphone permissions.
- [ ] Complete a standalone Android APK build and confirm a physical device renders the combined MP4 end to end.
- [ ] Complete cloud or local APK compilation: the Android SDK is installed, but this sandbox terminates Gradle before task configuration; native prebuild and direct NDK compilation of the compositor now succeed.
- [x] Diagnose the camera-only review ambiguity and add explicit merged-render status plus a version bump so the next APK is distinguishable.
- [x] Add concurrent native two-finger pinch resizing and one-finger drag movement for the floating reaction camera.
- [ ] Confirm physical Android rendering opens only a combined reaction video review or shows a specific native merged-render error.
- [x] Replace the camera-overlay gesture surface with a non-interactive camera preview beneath a dedicated native pan-and-pinch control layer.
- [x] Block camera-only reaction data from ever entering the final review route; only a flagged composite output can be reviewed, saved, or shared.
- [x] Add explicit native render-stage status and hard render-failure messaging to the recorder.
- [ ] Reproduce the full camera, gesture, recording, and composite-export workflow in an executable Android environment before sending another build claim.
- [ ] Do not issue further implementation-complete claims until a real merged MP4 has been inspected from the native runtime.
- [x] Remove direct React Navigation dependencies that prevent Expo Router from starting under Expo 56.
- [x] Install Expo Asset and align all remaining Expo 56 peer and toolchain versions before native APK validation.
- [x] Upgrade to Expo 57 and React Native 0.86.2+ to remove the diagnosed Hermes memory regression and Metro dependency override.
- [x] Replace the Android overlay input layer with an independently verifiable responder-based drag and pinch implementation that does not depend on the native camera view receiving gestures.
- [ ] Validate real source and camera URI accessibility, FFmpeg command construction, output creation, and recorded durations before navigating to review.
- [ ] Compile the refreshed Expo 57 Android native project locally, including ffmpeg-expo, before requesting any further owner-device test.
- [x] Replace the installed remux-only FFmpeg bridge with a reproducible full-command native implementation that can execute overlay and audio-mix filter graphs.
- [x] Compile the vendored arm64 FFmpeg JNI bridge directly with the Android NDK and verify the required overlay, crop, pad, scale, setsar, and amix filters are enabled.
- [x] Diagnose the owner-reported v1.0.3 Android regression from code and build artifacts before requesting another phone test.
- [x] Remove any unverified native dependency or interaction-layer change that can prevent the recorder from opening or responding on the owner’s Android phone.
- [ ] Do not ask for another publish or device test until the standalone APK path itself has been compiled and inspected.
- [x] Prevent the review screen from importing Android-only media-library code in the web bundle, which currently produces a server error during preview loading.

- [ ] Checkpoint the web-safe source selection and persistent preview startup repairs before restarting the managed development service.

- [x] Diagnose and repair the no-op source-video selection action reported in the preview.

- [x] Diagnose and repair the no-op source-video selection action reported in the preview.

- [ ] Surface web picker failures inline and restrict iOS-only picker options to iOS so source selection cannot appear to do nothing.
- [x] Surface web picker failures inline and restrict iOS-only picker options to iOS so source selection cannot appear to do nothing.

- [x] Diagnose and repair the no-op record action reported after entering the reaction recorder.

- [ ] Reproduce the owner-reported continued no-op Start recording interaction in the exact preview or Android runtime and repair the active path.

- [ ] Diagnose and repair the native Android reaction camera record invocation that fails to start a recording.
