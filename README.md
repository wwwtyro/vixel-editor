# Vixel

A javascript & webgl voxel path tracer. See it live [here](https://wwwtyro.github.io/vixel).

![vixel screenshot](media/screenshot-000.png)

## FAQ

**The image is converging very slowly. How can I speed it up?**

If your scene is being rendered at the refresh rate of your monitor (you're not GPU-bound), which in most cases would be 60FPS, you can increase the number of samples per frame to perform more work per frame.

If you're already GPU-bound (i.e., interaction seems slow or choppy), you're already converging as fast as you can for the resolution you've selected. Your only option at this point is to reduce the resolution.

**Interaction is slow or choppy. How can I make it smoother?**

You can either reduce the number of samples per frame or you can reduce the resolution.

A workflow on lower-end machines might be to reduce the samples per frame to one and decrease the resolution until the frame rate is acceptable for editing. When you're ready to render, bump up the resolution.

**I see some weird artifacts. How can I fix them?**

You may have found a bug. Post an issue with a screenshot and the copied URL and I'll see what can be done about it.
