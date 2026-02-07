// Background color for the scene
export const SCENE_BACKGROUND_COLOR = 0x0f0f0f;

/** Camera constants */
// Field of view
export const CAMERA_FOV = 45;
// Near plane
export const CAMERA_NEAR = 0.1;
// Far plane
export const CAMERA_FAR = 1000;
// Camera position
export const CAMERA_POSITION = [0, 0, 6] as const;

/** Earth constants */
// Radius
export const EARTH_RADIUS = 1;
// Segments
export const EARTH_SEGMENTS = 64;
// Earth texture
export const EARTH_TEXTURE = '/textures/earth.jpg';
// Directional light position
export const DIRECTIONAL_LIGHT_POSITION = [5, 3, 5] as const;

/** Camera controls */
export const CONTROLS_ROTATE_SPEED = 0.005;
export const CONTROLS_ROLL_SPEED = 0.001;
export const CONTROLS_TOUCH_MULTIPLIER = 2;
export const CONTROLS_ZOOM_SPEED = 0.05;
export const CONTROLS_MIN_DISTANCE = 1.1;
export const CONTROLS_MAX_DISTANCE = 20;
export const CONTROLS_DAMPING = 0.2;

/** Lights constants */
// Ambient light intensity
export const AMBIENT_LIGHT_INTENSITY = 0.6;
// Directional light intensity
export const DIRECTIONAL_LIGHT_INTENSITY = 1.2;
