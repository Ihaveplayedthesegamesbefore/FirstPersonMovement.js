var Pickupable = pc.createScript('pickupable');

// Initialize code called once per entity
Pickupable.prototype.initialize = function() {
    // Ensure the entity has a rigidbody component
    if (!this.entity.rigidbody) {
        console.error("Pickupable script needs to have a 'rigidbody' component");
    }
};

// Update code called every frame
Pickupable.prototype.update = function(dt) {
    // No update logic needed for this script
};
