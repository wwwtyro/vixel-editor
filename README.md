# Vixel

A javascript & webgl voxel path tracer. See it live [here](https://wwwtyro.github.io/vixel).

![vixel screenshot](media/screenshot-000.png)

![vixel screenshot](media/screenshot-001.png)

## Materials

- **Color** is the material's base color.

- **Roughness** describes how randomly specular light is reflected from the surface.

- **Metalness** describes how much of the light it reflects is diffusive. A purely metallic surface reflects zero light diffusively.

- **Emission** is how much light the material emits. If this value is greater than zero, only the **color** component of the material is used.

| Roughness | Metalness | Real world analogue | Rendered example                 |
| --------- | --------- | ------------------- | -------------------------------- |
| 0.0       | 0.0       | Smooth plastic      | ![thing](media/material-000.png) |
| 1.0       | 0.0       | Chalk               | ![thing](media/material-001.png) |
| 0.0       | 1.0       | Mirror              | ![thing](media/material-002.png) |
| 1.0       | 0.05      | Unpolished metal    | ![thing](media/material-003.png) |

## Ground

The **color**, **roughness**, and **metalness** properties can also be set for the ground plane, and are identical in meaning.

## Sky

- **Time** is simply the time of day on a 24-hour clock. The sun rises at 6:00 and sets at 18:00.

- **Azimuth** is the direction of the sun _around_ the up/down axis.

## Rendering

- **Width** and **Height** define the resolution of your rendered image.

- **DOF Distance** is how far into your scene the focus plane lies.

- **DOF Magnitude** is how strong the DOF effect is.

- **Samples/Frame** describes how many samples are taken per frame. `1` is one sample per pixel, per frame. If the interactivity of the editor is slow or
  choppy, you can reduce this to improve your framerate. Similarly, if you want to converge the scene faster, you can increase it (though increasing it is only
  effective until you're GPU bound).

- **Take Screenshot** will download a screenshot.

## Scene

- **Copy URL** copies the current scene to the clipboard and updates the URL. For now, this is the only way to save and share your scene. Feel free to paste it
  into a text file to save it longer term. Yes, there are absolutely plans to improve this.

- **Clear Scene** clears the scene of all voxels save one.
