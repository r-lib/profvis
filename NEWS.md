profvis 0.3.3.9000
==================

Fixed [#84](https://github.com/rstudio/profvis/issues/84): In the data pane, leaf nodes (representing top-most calls on the stack) were not displayed.

Addressed [#82](https://github.com/rstudio/profvis/issues/82): In the data pane, if a node has exactly one child, that child will automatically be expanded. This makes it more efficient to explore the data. ([#83](https://github.com/rstudio/profvis/pull/83))

Fixed [#50](https://github.com/rstudio/profvis/issues/50): In the data pane, function calls were shown in reverse order.

profvis 0.3.3
=============

* Fixed [#68](https://github.com/rstudio/profvis/issues/68): Profvis threw an error when a package was installed using `devtools::install_github(args = "--with-keep.source")`.

* Fix bug where, when loading a profile that didn't contain memory data, profvis would throw an error. [#66](https://github.com/rstudio/profvis/pull/66)

* Fixed [#73](https://github.com/rstudio/profvis/issues/73): Profvis would throw an error if used on code sourced from a remote URL.
