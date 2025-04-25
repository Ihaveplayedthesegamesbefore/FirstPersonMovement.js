var FirstPersonMovement = pc.createScript('firstPersonMovement');

FirstPersonMovement.attributes.add('camera', {
    type: 'entity',
    description: 'Optional, assign a camera entity, otherwise one is created'
});

FirstPersonMovement.attributes.add('power', {
    type: 'number',
    default: 900,  // Increased movement speed
    description: 'Adjusts the speed of player movement'
});

FirstPersonMovement.attributes.add('jumpPower', {
    type: 'number',
    default: 200,
    description: 'Adjusts the strength of the jump'
});

FirstPersonMovement.attributes.add('lookSpeed', {
    type: 'number',
    default: 0.25,
    description: 'Adjusts the sensitivity of looking'
});

FirstPersonMovement.attributes.add('sprintPower', {
    type: 'number',
    default: 1500,  // Increased sprint speed
    description: 'Adjusts the speed of player movement while sprinting'
});

FirstPersonMovement.attributes.add('pickupDistance', {
    type: 'number',
    default: 2,
    description: 'Maximum distance to pick up objects'
});

FirstPersonMovement.attributes.add('throwForce', {
    type: 'number',
    default: 12,
    description: 'Force applied to thrown objects'
});

FirstPersonMovement.attributes.add('punchForce', {
    type: 'number',
    default: 50,
    description: 'Force applied to objects when punched'
});

FirstPersonMovement.attributes.add('crouchHeight', {
    type: 'number',
    default: 0.5,
    description: 'Height of the camera when crouching'
});

FirstPersonMovement.attributes.add('crouchSpeed', {
    type: 'number',
    default: 400,
    description: 'Speed of player movement while crouching'
});

FirstPersonMovement.attributes.add('capsuleHeight', {
    type: 'number',
    default: 1.8,
    description: 'Height of the capsule collider when standing'
});

FirstPersonMovement.attributes.add('capsuleRadius', {
    type: 'number',
    default: 0.5,
    description: 'Radius of the capsule collider'
});

FirstPersonMovement.attributes.add('capsuleCrouchHeight', {
    type: 'number',
    default: 0.9,
    description: 'Height of the capsule collider when crouching'
});

FirstPersonMovement.attributes.add('isLocalPlayer', {
    type: 'boolean',
    default: true,
    description: 'Is this the local player?'
});

FirstPersonMovement.attributes.add('gravity', {
    type: 'number',
    default: -19.62,  // Increased gravity
    description: 'Gravity force applied to the player'
});

FirstPersonMovement.attributes.add('terminalVelocity', {
    type: 'number',
    default: 100,  // Increased terminal velocity
    description: 'Maximum falling speed of the player'
});

FirstPersonMovement.attributes.add('bobbingAmplitude', {
    type: 'number',
    default: 0.1, // Increased amplitude for more noticeable view bobbing
    description: 'Amplitude of the view bobbing effect'
});

FirstPersonMovement.attributes.add('bobbingFrequency', {
    type: 'number',
    default: 10,
    description: 'Frequency of the view bobbing effect'
});

FirstPersonMovement.attributes.add('idleBobbingAmplitude', {
    type: 'number',
    default: 0.05, // Increased amplitude for more noticeable idle bobbing
    description: 'Amplitude of the idle view bobbing effect'
});

FirstPersonMovement.attributes.add('idleBobbingFrequency', {
    type: 'number',
    default: 1,
    description: 'Frequency of the idle view bobbing effect'
});

// Modes
FirstPersonMovement.MODE_NONE = 0;
FirstPersonMovement.MODE_GRAB = 1;
FirstPersonMovement.MODE_OTHER = 2; // Placeholder for another mode

// Initialize code called once per entity
FirstPersonMovement.prototype.initialize = function() {
    this.force = new pc.Vec3();
    this.eulers = new pc.Vec3();
    this.maxLookUp = 90;  // Maximum angle to look up
    this.maxLookDown = -90;  // Maximum angle to look down
    this.isGrounded = false; // Track if player is on the ground
    this.pickedObject = null; // Track the picked object
    this.currentMode = FirstPersonMovement.MODE_NONE; // Current mode
    this.isCrouching = false; // Track if player is crouching
    this.isSprinting = false; // Track if the player is sprinting
    this.isRotating = false; // Track if the player is rotating the picked object
    this.currentGravity = this.gravity; // Current gravity
    this.bobbingTime = 0; // Time tracker for view bobbing
    this.idleBobbingTime = 0; // Time tracker for idle view bobbing
    this.crouchTransitionTime = 0.2; // Duration of crouch transition in seconds
    this.crouchTransitionProgress = 1; // Track crouch transition progress (0 to 1)

    if (!this.isLocalPlayer) {
        this.entity.rigidbody.enabled = false;
        return;
    }

    var app = this.app;

    app.mouse.on("mousemove", this._onMouseMove, this);
    app.mouse.on("mousedown", this._onMouseDown, this);
    app.mouse.on("mouseup", this._onMouseUp, this);

    app.keyboard.on(pc.EVENT_KEYDOWN, this._onKeyDown, this);
    app.keyboard.on(pc.EVENT_KEYUP, this._onKeyUp, this);

    this.entity.collision.on("contact", this._onContact, this);

    if (!this.entity.collision) {
        console.error("First Person Movement script needs to have a 'collision' component");
    }

    if (!this.entity.rigidbody || this.entity.rigidbody.type !== pc.BODYTYPE_DYNAMIC) {
        console.error("First Person Movement script needs to have a DYNAMIC 'rigidbody' component");
    }

    this._setupCapsuleCollider();

    // Ensure the player starts in standing mode
    this._setCrouch(false);
};

// Update code called every frame
FirstPersonMovement.prototype.update = function(dt) {
    if (!this.camera) {
        this._createCamera();
    }

    var force = this.force;
    var app = this.app;
    var forward = this.camera.forward;
    var right = this.camera.right;

    var x = 0;
    var z = 0;

    if (app.keyboard.isPressed(pc.KEY_A)) {
        x -= right.x;
        z -= right.z;
    }

    if (app.keyboard.isPressed(pc.KEY_D)) {
        x += right.x;
        z += right.z;
    }

    if (app.keyboard.isPressed(pc.KEY_W)) {
        x += forward.x;
        z += forward.z;
    }

    if (app.keyboard.isPressed(pc.KEY_S)) {
        x -= forward.x;
        z -= forward.z;
    }

    var currentPower = this.power;
    this.isSprinting = app.keyboard.isPressed(pc.KEY_SHIFT);

    if (this.isCrouching) {
        currentPower = this.crouchSpeed;
    } else if (this.isSprinting) {
        currentPower = this.sprintPower;
    }

    if (x !== 0 || z !== 0) {
        force.set(x, 0, z).normalize().scale(currentPower);
        this.entity.rigidbody.applyForce(force);
        this.isMoving = true;
        this.bobbingTime += dt * this.bobbingFrequency;
    } else {
        this.isMoving = false;
        this.bobbingTime = 0;
        if (!this.isCrouching) {
            this.idleBobbingTime += dt * this.idleBobbingFrequency;
        }
    }

    if (!this.isRotating) {
        this.camera.setLocalEulerAngles(this.eulers.y, this.eulers.x, 0);
    }

    // Update the position of the picked object
    if (this.pickedObject) {
        var cameraPos = this.camera.getPosition();
        var pickupPos = cameraPos.clone().add(this.camera.forward.clone().scale(this.pickupDistance));
        this.pickedObject.setPosition(pickupPos);
        this.pickedObject.rigidbody.angularVelocity = pc.Vec3.ZERO; // Ensure the picked object does not spin
        this.pickedObject.rigidbody.linearVelocity = pc.Vec3.ZERO; // Ensure the picked object doesn't drift
    }

    // Apply view bobbing effect
    if (this.isMoving) {
        var bobbingOffset = Math.sin(this.bobbingTime) * this.bobbingAmplitude;
        this.camera.setLocalPosition(0, this.capsuleHeight / 2 + bobbingOffset, 0);
    } else if (!this.isCrouching) {
        var idleBobbingOffset = Math.sin(this.idleBobbingTime) * this.idleBobbingAmplitude;
        this.camera.setLocalPosition(0, this.capsuleHeight / 2 + idleBobbingOffset, 0);
    }

    // Check if player is grounded
    this._checkGrounded();

    // Apply continuous gravity to ensure realistic falling
    if (!this.isGrounded) {
        var gravityForce = new pc.Vec3(0, this.currentGravity * this.entity.rigidbody.mass * dt, 0);
        this.entity.rigidbody.applyForce(gravityForce);

        // Clamp the falling speed to terminal velocity
        var velocity = this.entity.rigidbody.linearVelocity;
        if (Math.abs(velocity.y) > this.terminalVelocity) {
            velocity.y = this.terminalVelocity * Math.sign(velocity.y);
            this.entity.rigidbody.linearVelocity = velocity;
        }
    }

    // Handle crouch transition
    if (this.crouchTransitionProgress < 1) {
        this.crouchTransitionProgress += dt / this.crouchTransitionTime;
        this.crouchTransitionProgress = Math.min(this.crouchTransitionProgress, 1);
        var currentHeight = pc.math.lerp(
            this.isCrouching ? this.capsuleHeight / 2 : this.crouchHeight,
            this.isCrouching ? this.crouchHeight : this.capsuleHeight / 2,
            this.crouchTransitionProgress
        );
        this.camera.setLocalPosition(0, currentHeight, 0);
        this.entity.collision.height = pc.math.lerp(
            this.isCrouching ? this.capsuleHeight : this.capsuleCrouchHeight,
            this.isCrouching ? this.capsuleCrouchHeight : this.capsuleHeight,
            this.crouchTransitionProgress
        );
    }

    // Handle crouch input
    if (app.keyboard.isPressed(pc.KEY_C) && !this.isCrouching) {
        this._setCrouch(true);
    } else if (!app.keyboard.isPressed(pc.KEY_C) && this.isCrouching) {
        if (!this._isObstacleAbove()) {
            this._setCrouch(false);
        }
    }
};

FirstPersonMovement.prototype._onMouseMove = function(e) {
    if (pc.Mouse.isPointerLocked() || e.buttons[0]) {
        if (this.isRotating && this.pickedObject) {
            this.pickedObject.rotateLocal(e.dy * this.lookSpeed, e.dx * this.lookSpeed, 0);
        } else {
            this.eulers.x -= this.lookSpeed * e.dx;
            this.eulers.y -= this.lookSpeed * e.dy;

            // Clamp the vertical rotation between maxLookDown and maxLookUp
            this.eulers.y = pc.math.clamp(this.eulers.y, this.maxLookDown, this.maxLookUp);
        }
    }
};

FirstPersonMovement.prototype._onMouseDown = function(e) {
    this.app.mouse.enablePointerLock();
    if (this.currentMode === FirstPersonMovement.MODE_GRAB) {
        if (e.button === pc.MOUSEBUTTON_LEFT) {
            if (this.pickedObject) {
                // Drop the object
                this._dropObject();
            } else {
                // Try to pick up an object
                this._tryPickupObject();
            }
        } else if (e.button === pc.MOUSEBUTTON_RIGHT && this.pickedObject) {
            // Throw the object
            this._throwObject();
        }
    }
};

FirstPersonMovement.prototype._onMouseUp = function(e) {
    // Implement any necessary logic for mouse button release
};

FirstPersonMovement.prototype._onKeyDown = function(e) {
    if (e.key === pc.KEY_SPACE && this.isGrounded) {
        this.entity.rigidbody.applyImpulse(0, this.jumpPower, 0);
        this.isGrounded = false;
    }
    if (e.key === pc.KEY_1) {
        this.currentMode = FirstPersonMovement.MODE_GRAB;
    }
    if (e.key === pc.KEY_2) {
        this.currentMode = FirstPersonMovement.MODE_OTHER; // Placeholder for another mode
    }

    if (this.currentMode === FirstPersonMovement.MODE_GRAB) {
        if (e.key === pc.KEY_F) {
            // Punch the object
            this._punchObject();
        }
        if (e.key === pc.KEY_R) {
            // Start rotating the object
            this.isRotating = true;
        }
    }
};

FirstPersonMovement.prototype._onKeyUp = function(e) {
    if (e.key === pc.KEY_C && this.isCrouching) {
        if (!this._isObstacleAbove()) {
            this._setCrouch(false);
        }
    }
    if (e.key === pc.KEY_R) {
        // Stop rotating the object
        this.isRotating = false;
    }
};

FirstPersonMovement.prototype._setCrouch = function(crouch) {
    this.isCrouching = crouch;
    this.crouchTransitionProgress = 0; // Reset transition progress
};

FirstPersonMovement.prototype._setupCapsuleCollider = function() {
    this.entity.collision.type = 'capsule';
    this.entity.collision.height = this.capsuleHeight;
    this.entity.collision.radius = this.capsuleRadius;
};

FirstPersonMovement.prototype._onContact = function(result) {
    if (result.other && result.other.rigidbody) {
        // Ensure the contact is with the ground
        var contacts = result.contacts;
        for (var i = 0; i < contacts.length; i++) {
            var normal = contacts[i].normal;
            if (Math.abs(normal.y) > 0.5) {
                this.isGrounded = true;
                break;
            }
        }
    }
};

FirstPersonMovement.prototype._createCamera = function() {
    this.camera = new pc.Entity();
    this.camera.setName("First Person Camera");
    this.camera.addComponent("camera");
    this.entity.addChild(this.camera);
    this.camera.setLocalPosition(0, this.capsuleHeight / 2, 0);
};

FirstPersonMovement.prototype._tryPickupObject = function() {
    var app = this.app;
    var from = this.camera.getPosition();
    var to = from.clone().add(this.camera.forward.clone().scale(this.pickupDistance));

    // Perform a raycast
    var result = app.systems.rigidbody.raycastFirst(from, to);
    if (result && result.entity && result.entity.script && result.entity.script.pickupable) {
        this.pickedObject = result.entity;
        this.pickedObject.rigidbody.type = pc.BODYTYPE_KINEMATIC; // Make the object kinematic while picked up
        this.pickedObject.rigidbody.angularVelocity = pc.Vec3.ZERO; // Stop any rotation
        this.pickedObject.rigidbody.linearVelocity = pc.Vec3.ZERO; // Stop any movement
    }
};

FirstPersonMovement.prototype._dropObject = function() {
    if (this.pickedObject) {
        this.pickedObject.rigidbody.type = pc.BODYTYPE_DYNAMIC;
        this.pickedObject = null;
    }
};

FirstPersonMovement.prototype._throwObject = function() {
    if (this.pickedObject) {
        var forward = this.camera.forward.clone().scale(this.throwForce);
        this.pickedObject.rigidbody.type = pc.BODYTYPE_DYNAMIC;
        this.pickedObject.rigidbody.applyImpulse(forward);
        this.pickedObject = null;
    }
};

FirstPersonMovement.prototype._punchObject = function() {
    var app = this.app;
    var from = this.camera.getPosition();
    var to = from.clone().add(this.camera.forward.clone().scale(this.punchForce));

    // Perform a raycast
    var result = app.systems.rigidbody.raycastFirst(from, to);
    if (result && result.entity && result.entity.rigidbody) {
        var forward = this.camera.forward.clone().scale(this.punchForce);
        result.entity.rigidbody.applyImpulse(forward);
    }
};

FirstPersonMovement.prototype._checkGrounded = function() {
    var rayStart = this.entity.getPosition().clone();
    var rayEnd = new pc.Vec3(rayStart.x, rayStart.y - 0.2, rayStart.z); // Adjust the distance based on your needs

    var result = this.app.systems.rigidbody.raycastFirst(rayStart, rayEnd);
    this.isGrounded = !!result;
};

FirstPersonMovement.prototype._isObstacleAbove = function() {
    var rayStart = this.entity.getPosition().clone();
    var rayEnd = new pc.Vec3(rayStart.x, rayStart.y + (this.capsuleHeight - this.capsuleCrouchHeight), rayStart.z); // Raycast distance is the difference in height between standing and crouching

    var result = this.app.systems.rigidbody.raycastFirst(rayStart, rayEnd);
    return !!result;
};