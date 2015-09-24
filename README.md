profvis
=======

profvis is a tool for visualizing code profiling data from R. It creates an web page which provides a graphical interface for exploring the profiling data.


## Installation

```R
devtools::install_github("rstudio/profvis")
```


## Example

To run code with profiling, wrap the expression in `prof()`, and store the output, like so:

```R
library(profvis)
library(ggplot2)  # We'll profile a ggplot graphic

p <- prof({
  g <- ggplot(diamonds, aes(carat, price)) + geom_point(size = 1, alpha = 0.2)
  print(g)
})
```

After running the profiler, use `profvis()` to create the interactive web page. Note that you will need a wide browser window to view it properly.

```R
# Temporary workaround to make sure it displays in a new browser window instead
# of the RStudio viewer pane.
options(viewer = function(url, ...) browseURL(url))

profvis(p)
```
