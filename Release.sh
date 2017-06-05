# svn info --xml | sed -n '1,6p;18,24p' > svninfo.xml
svn info | grep Last > svninfo.txt


cd ..
rm /tmp/cfda.website.server.tar.gz
tar --no-same-owner -zcvf  /tmp/cfda.website.server.tar.gz website.server
echo /tmp/cfda.website.server.tar.gz is created.
