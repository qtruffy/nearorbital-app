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
export const CONTROLS_ROTATE_SPEED = 0.001;
export const CONTROLS_ROLL_SPEED = 0.001;
export const CONTROLS_TOUCH_MULTIPLIER = 2;
export const CONTROLS_ZOOM_SPEED = 0.05;
export const CONTROLS_MIN_DISTANCE = 1.1;
export const CONTROLS_MAX_DISTANCE = 20;
export const CONTROLS_DAMPING = 0.9;

/** Lights constants */
// Ambient light intensity
export const AMBIENT_LIGHT_INTENSITY = 0.6;
// Directional light intensity
export const DIRECTIONAL_LIGHT_INTENSITY = 1.2;

/** Satellite constants */
// Real Earth radius in km (for orbital conversion)
export const EARTH_RADIUS_KM = 6371;
// Standard gravitational parameter (km³/s²)
export const MU_EARTH_KM3S2 = 398600.4418;
// Point size for satellite dots
export const SATELLITE_POINT_SIZE = 2;
// Satellite color (cyan)
export const SATELLITE_COLOR = 0x4fc3f7;
// Satellite opacity
export const SATELLITE_OPACITY = 0.8;
// Available time warp speeds
export const TIME_WARP_SPEEDS = [1, 10, 100, 500, 2000] as const;

/** Orbit line */
// Number of segments to draw one full orbit
export const ORBIT_SEGMENTS = 256;
// Orbit line color
export const ORBIT_LINE_COLOR = 0x4fc3f7;
// Orbit line opacity
export const ORBIT_LINE_OPACITY = 0.5;
// Dash size (scene units)
export const ORBIT_DASH_SIZE = 0.04;
// Gap size (scene units)
export const ORBIT_GAP_SIZE = 0.02;
// Raycaster threshold for picking satellite points
export const PICK_THRESHOLD = 0.005;

/** Follow camera (satellite lock) */
// Initial camera distance from satellite when first selecting
export const FOLLOW_INITIAL_DISTANCE = 0.4;
// Min/max distance from satellite in follow mode
export const FOLLOW_MIN_DISTANCE = 0.2;
export const FOLLOW_MAX_DISTANCE = 5.0;
// Lerp factor for smooth zoom toward satellite
export const CAMERA_FOLLOW_LERP = 0.08;
// Lerp factor for smooth return to Earth center on deselect
export const CAMERA_RETURN_LERP = 0.04;
// Rotation speed in follow mode (rad/px) — matches free mode base speed
export const FOLLOW_ROTATE_SPEED = 0.001;
// Extra multiplier for follow-mode rotation sensitivity (increase to make more sensitive)
export const FOLLOW_ROTATE_MULTIPLIER = 3;
