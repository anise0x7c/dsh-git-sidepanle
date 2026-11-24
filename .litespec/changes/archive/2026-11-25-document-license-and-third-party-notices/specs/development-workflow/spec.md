# development-workflow delta

## ADDED Requirements

### Requirement: Third-party attribution and notices

The plugin SHALL ship its own license together with a third-party notices
document that names every third-party component it contains or is derived
from, that component's license, and its copyright holder, including the full
license text where the license requires one. A source file derived from another
project SHALL retain that project's copyright line and point at the notices
document. A dependency or asset that enters the distributed file set SHALL be
recorded in the notices document in the same change, and the document SHALL
state which runtime externals and build-time dependencies are not distributed.

#### Scenario: Install a prepared directory

- **WHEN** the prepared plugin directory is installed
- **THEN** it contains the plugin's license and the third-party notices, and the
  notices name Code OSS with its MIT license text

#### Scenario: Derived source file

- **WHEN** a contributor ports code from another project into a source file
- **THEN** the file keeps that project's copyright line and the notices
  document records the component, its license and its holder

#### Scenario: New distributed material

- **WHEN** a change adds a dependency or asset that is distributed with the
  plugin
- **THEN** the notices document is updated in the same change, or the material
  is marked as host-provided or build-time only

#### Scenario: Unshipped dependencies

- **WHEN** a consumer reads the notices to learn what the plugin does not bundle
- **THEN** the runtime externals and the build-time development dependencies are
  identified as not distributed
