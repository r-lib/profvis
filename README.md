Profvis
=======

[![Travis-CI Build Status](https://travis-ci.org/rstudio/profvis.svg?branch=master)](https://travis-ci.org/rstudio/profvis)

Profvis is a tool for visualizing code profiling data from R. It creates a web page which provides a graphical interface for exploring the data. [Live demo](http://rpubs.com/wch/178493).


## Installation

```R
install.packages("profvis")
```

## Documentation

See the [documentation site](https://rstudio.github.io/profvis/).

## Example

To run code with profiling, wrap the expression in `profvis()`. By default, this will result in the interactive profile visualizer opening in a web browser. You can see a live demo [here](http://rpubs.com/wch/178493).

```R
library(profvis)

profvis({
  library(ggplot2)
  g <- ggplot(diamonds, aes(carat, price)) + geom_point(size = 1, alpha = 0.2)
  print(g)
})
```


The `profvis()` call returns an [htmlwidget](http://www.htmlwidgets.org/), which by default when printed opens a web browser. If you wish to save the object, it won't open the browser at first, but you can view it later by typing the variable name at the console, or calling `print()` on it.

```R
p <- profvis({
  g <- ggplot(diamonds, aes(carat, price)) + geom_point(size = 1, alpha = 0.2)
  print(g)
})


# View it with:
p
# or print(p)
```
